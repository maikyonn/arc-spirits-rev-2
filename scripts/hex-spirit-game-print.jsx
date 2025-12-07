#target photoshop

/**
 * Hex Spirit Game Print Builder
 * -------------------------------------------
 * This script consumes the CSV + art raw bundle exported from the Hex Spirits admin page.
 * Update the four paths below to point to your local template, CSV, art folder, and output directory
 * before running inside Photoshop.
 */

// === CONFIGURATION ===
var templateFile = new File('/Users/maikyon/Library/CloudStorage/GoogleDrive-michaelmqvu@gmail.com/My Drive/Arc Spirits/CharacterHex/spirit_hex_grey.psd');
var scriptFolder = File($.fileName).parent;
var packRoot = scriptFolder ? scriptFolder.parent : Folder.current;
var csvFile = new File(packRoot + '/hex_spirits_art_raw.csv');
var artFolder = new Folder(packRoot + '/art_raw');
var exportFolder = new Folder(packRoot + '/game_prints');

validatePath(templateFile, 'Template PSD');
validatePath(csvFile, 'CSV data');
validatePath(artFolder, 'Art raw folder');
if (!exportFolder.exists) exportFolder.create();

var csvRows = readCSV(csvFile);
if (!csvRows || csvRows.length === 0) {
    alert('CSV is empty. Re‑export from the Hex Spirits admin.');
    exit();
}

var header = csvRows.shift();
var rows = [];
for (var r = 0; r < csvRows.length; r++) {
	var row = {};
	var line = csvRows[r];
	for (var c = 0; c < header.length; c++) {
		row[header[c]] = line && line[c] ? line[c] : '';
	}
	rows.push(row);
}

var unique = uniqueRows(rows);
// Cost-based layer folders in the template
var costFolders = [
    'Human',
    'Minor',
    'Minor2',
    'Greater',
    'Exalted',
    'Ancient'
];

// Map cost value to folder name
function costToFolder(cost) {
    var c = parseInt(cost, 10);
    switch (c) {
        case 1: return 'Human';
        case 3: return 'Minor';
        case 5: return 'Minor2';
        case 7: return 'Greater';
        case 9: return 'Exalted';
        case 11: return 'Ancient';
        default: return 'Minor'; // fallback
    }
}

for (var i = 0; i < unique.length; i++) {
    var row = unique[i];
    var artFile = new File(artFolder + '/' + row['ArtRawFile']);
    if (!artFile.exists) {
        alert('Missing art raw for ' + row['Name'] + ' (' + row['ArtRawFile'] + ')');
        continue;
    }

    var folder = costToFolder(row['Cost']);
    var doc = app.open(templateFile);
    try {
        configureRarity(doc, costFolders, folder);
        swapLayerImage(doc, ['Hex', 'Art', 'IMAGE_PLACEHOLDER'], artFile);
        updateText(doc, row, folder);
        savePng(doc, exportFolder, folder, row['GamePrintFile']);
    } catch (err) {
        alert('Failed on ' + row['Name'] + ': ' + err.message);
    } finally {
        doc.close(SaveOptions.DONOTSAVECHANGES);
    }
}

alert('Export finished! Files saved to ' + exportFolder.fsName);

// === HELPERS ===
function validatePath(fileOrFolder, label) {
    if (!fileOrFolder.exists) {
        alert(label + ' not found at: ' + fileOrFolder.fsName);
        exit();
    }
}

function uniqueRows(rows) {
    var map = {};
    var list = [];
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var key = r['SpiritID'];
        if (!map[key]) {
            map[key] = true;
            list.push(r);
        }
    }
    return list;
}

function readCSV(file) {
	file.open('r');
	var content = file.read();
	file.close();
	if (content === undefined || content === null) {
		return null;
	}
	var normalized = typeof content === 'string' ? content : content.toString();
	var rawLines = normalized.split(/\r?\n/);
	var lines = [];
	for (var i = 0; i < rawLines.length; i++) {
		var trimmed = rawLines[i].replace(/^\s+|\s+$/g, '');
		if (trimmed.length > 0) {
			lines.push(rawLines[i]);
		}
	}
	if (lines.length === 0) return null;
	var parsed = [];
	for (var li = 0; li < lines.length; li++) {
		parsed.push(parseCSVLine(lines[li]));
	}
	return parsed;
}

function parseCSVLine(line) {
    var values = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i);
        if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line.charAt(i + 1) === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
	values.push(current);
	for (var valIndex = 0; valIndex < values.length; valIndex++) {
		values[valIndex] = values[valIndex].replace(/^\s+|\s+$/g, '');
	}
	return values;
}

function configureRarity(doc, allRarities, activeRarity) {
    var hex = findLayer(doc, ['Hex']);
    if (!hex) throw new Error('Hex folder missing');
    for (var i = 0; i < allRarities.length; i++) {
        var folder = findLayer(doc, ['Hex', allRarities[i]]);
        if (folder) folder.visible = false;
    }
    var active = findLayer(doc, ['Hex', activeRarity]);
    if (!active) throw new Error('Rarity folder not found: ' + activeRarity);
    active.visible = true;
    var artLayer = findLayer(doc, ['Hex', 'Art']);
    if (artLayer) artLayer.visible = true;
}

function swapLayerImage(doc, pathArray, imageFile) {
    var placeholder = findLayer(doc, pathArray);
    if (!placeholder) throw new Error('Missing layer ' + pathArray[pathArray.length - 1]);
    replaceLayerContents(doc, placeholder, imageFile);
}

function updateText(doc, row, folder) {
    updateLayerText(doc, ['Hex', folder, 'Info', 'Name'], row['Name']);
}

function updateLayerText(doc, path, value) {
    var layer = findLayer(doc, path);
    if (layer && layer.kind === LayerKind.TEXT) {
        layer.textItem.contents = value || '';
    }
}


function findLayer(doc, path) {
    var root = doc;
    for (var i = 0; i < path.length; i++) {
        var name = path[i];
        var next = null;
        var layers = root.layers || [];
        for (var j = 0; j < layers.length; j++) {
            if (layers[j].name === name) {
                next = layers[j];
                break;
            }
        }
        if (!next) return null;
        root = next;
    }
    return root;
}

function savePng(doc, baseFolder, rarityFolder, fileName) {
    var rarityDir = new Folder(baseFolder + '/' + rarityFolder);
    if (!rarityDir.exists) rarityDir.create();
    var file = new File(rarityDir + '/' + fileName);
    var opts = new ExportOptionsSaveForWeb();
    opts.format = SaveDocumentType.PNG;
    opts.PNG8 = false;
    opts.transparency = true;
    opts.interlaced = false;
    opts.quality = 100;
    doc.exportDocument(file, ExportType.SAVEFORWEB, opts);
}

function boundsToRect(bounds) {
    var left = bounds[0].as('px');
    var top = bounds[1].as('px');
    var right = bounds[2].as('px');
    var bottom = bounds[3].as('px');
    var width = right - left;
    var height = bottom - top;
    return {
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        width: width,
        height: height,
        centerX: left + (width / 2),
        centerY: top + (height / 2)
    };
}

function fitLayerToRect(layer, targetRect) {
    var prevUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    try {
        var current = boundsToRect(layer.bounds);
        if (current.width === 0 || current.height === 0) return;

        // Force the smart object bounds to match the placeholder exactly.
        var widthScale = (targetRect.width / current.width) * 100;
        var heightScale = (targetRect.height / current.height) * 100;
        layer.resize(widthScale, heightScale, AnchorPosition.MIDDLECENTER);

        var resized = boundsToRect(layer.bounds);
        var deltaX = targetRect.centerX - resized.centerX;
        var deltaY = targetRect.centerY - resized.centerY;
        layer.translate(deltaX, deltaY);
    } finally {
        app.preferences.rulerUnits = prevUnits;
    }
}

function replaceLayerContents(doc, layer, imageFile) {
    app.activeDocument = doc;
    doc.activeLayer = layer;
    var targetRect = boundsToRect(layer.bounds);

    var action = stringIDToTypeID('placedLayerReplaceContents');
    var desc = new ActionDescriptor();
    desc.putPath(charIDToTypeID('null'), imageFile);
    desc.putInteger(charIDToTypeID('Lnkd'), 0);
    executeAction(action, desc, DialogModes.NO);
    fitLayerToRect(doc.activeLayer, targetRect);
}

