# UI Components

Base UI components for Arc Spirits Rev 2, built with Svelte 5 runes syntax.

## Components

### Button
Unified button component with multiple variants and sizes.

```svelte
<script>
  import { Button } from '$lib/components/ui';
</script>

<Button variant="primary" size="md">Click me</Button>
<Button variant="secondary" disabled>Disabled</Button>
<Button variant="danger" loading>Loading...</Button>
<Button variant="ghost" size="sm">Ghost</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'ghost' (default: 'secondary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `disabled`: boolean (default: false)
- `loading`: boolean (default: false)
- `type`: 'button' | 'submit' (default: 'button')
- `onclick`: (e: MouseEvent) => void

### FormField
Form field wrapper with label, error, and helper text support.

```svelte
<script>
  import { FormField, Input } from '$lib/components/ui';

  let email = $state('');
  let error = $state('');
</script>

<FormField label="Email" {error} required helperText="We'll never share your email">
  <Input type="email" bind:value={email} />
</FormField>
```

**Props:**
- `label`: string (required)
- `error`: string
- `required`: boolean (default: false)
- `helperText`: string

### Input
Styled text input with error state support.

```svelte
<script>
  import { Input } from '$lib/components/ui';

  let name = $state('');
</script>

<Input
  type="text"
  placeholder="Enter your name"
  bind:value={name}
  error={name.length > 50}
/>
```

**Props:**
- `type`: string (default: 'text')
- `placeholder`: string
- `value`: string | number (bindable)
- `disabled`: boolean (default: false)
- `error`: boolean (default: false)
- `oninput`: (e: Event) => void
- `onblur`: (e: FocusEvent) => void
- `onfocus`: (e: FocusEvent) => void

### Select
Styled select dropdown with support for simple arrays and objects.

```svelte
<script>
  import { Select } from '$lib/components/ui';

  let role = $state('');

  const roles = [
    { value: 'admin', label: 'Administrator' },
    { value: 'user', label: 'User' },
    { value: 'guest', label: 'Guest' }
  ];

  // Or simple array:
  const simpleOptions = ['Option 1', 'Option 2', 'Option 3'];
</script>

<Select
  options={roles}
  bind:value={role}
  placeholder="Select a role"
/>
```

**Props:**
- `options`: Array<{value: string | number, label: string} | string | number> (required)
- `value`: string | number (bindable)
- `placeholder`: string
- `disabled`: boolean (default: false)
- `error`: boolean (default: false)
- `onchange`: (e: Event) => void

### Textarea
Styled textarea with resize support.

```svelte
<script>
  import { Textarea } from '$lib/components/ui';

  let description = $state('');
</script>

<Textarea
  placeholder="Enter description"
  bind:value={description}
  rows={6}
/>
```

**Props:**
- `placeholder`: string
- `value`: string (bindable)
- `rows`: number (default: 4)
- `disabled`: boolean (default: false)
- `error`: boolean (default: false)
- `oninput`: (e: Event) => void
- `onblur`: (e: FocusEvent) => void
- `onfocus`: (e: FocusEvent) => void

## Complete Form Example

```svelte
<script>
  import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';

  let formData = $state({
    name: '',
    email: '',
    role: '',
    bio: ''
  });

  let errors = $state({
    name: '',
    email: '',
    role: ''
  });

  const roles = [
    { value: 'developer', label: 'Developer' },
    { value: 'designer', label: 'Designer' },
    { value: 'manager', label: 'Manager' }
  ];

  function handleSubmit() {
    // Validation logic
    if (!formData.name) {
      errors.name = 'Name is required';
      return;
    }
    // Submit form...
  }
</script>

<form onsubmit={handleSubmit}>
  <FormField label="Name" error={errors.name} required>
    <Input bind:value={formData.name} error={!!errors.name} />
  </FormField>

  <FormField label="Email" error={errors.email} required>
    <Input type="email" bind:value={formData.email} error={!!errors.email} />
  </FormField>

  <FormField label="Role" error={errors.role} required>
    <Select options={roles} bind:value={formData.role} error={!!errors.role} />
  </FormField>

  <FormField label="Bio" helperText="Tell us about yourself">
    <Textarea bind:value={formData.bio} rows={4} />
  </FormField>

  <Button type="submit" variant="primary">Submit</Button>
</form>
```

## Styling

All components match the existing dark theme:
- Background: `rgba(15, 23, 42, 0.65)`
- Borders: `rgba(148, 163, 184, 0.3)`
- Focus: Blue gradient (`rgba(96, 165, 250, 0.75)`)
- Primary: Purple/blue gradient (`#4f46e5` to `#7c3aed`)
- Error: Red tint (`rgba(248, 113, 113, 0.6)`)
