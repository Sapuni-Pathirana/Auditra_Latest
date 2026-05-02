# Sri Lankan Form Validation Guide

This document outlines the validation rules implemented for both forms (Employee Registration and Client Registration) to comply with Sri Lankan standards.

---

## Field Validation Rules

### 1. **Phone Number** ✅
**Sri Lankan phone number formats are now supported:**

#### Mobile Numbers:
- Format: `0701234567` (10 digits)
- Valid prefixes: 070, 071, 075, 076, 077, 078
- Example: `0701234567`, `0711234567`, `0751234567`

#### Landline Numbers:
- Format: `0111234567` (9-10 digits)
- Valid area codes: 011, 012, 021, 022, 031, 032, 041, 042, 051, 052, 055, 065, 066, 081, 091
- Cities:
  - 011: Colombo
  - 012: Galle
  - 021: Kandy
  - 022: Matara
  - 031: Jaffna
  - 041: Kurunegala
  - 051: Badulla
  - 055: Kegalle
  - 065: Ratnapura
  - 081: Anuradhapura
  - 091: Trincomalee

#### International Format:
- Format: `+9470xxxxxxx` or `+94111234567`
- Country code: +94
- Rest follows mobile/landline patterns (without leading 0)

**Valid Examples:**
- ✅ `0701234567`
- ✅ `0111234567`
- ✅ `+94701234567`
- ✅ `071-123-4567`
- ✅ `0701 234 567`

**Invalid Examples:**
- ❌ `0601234567` (invalid prefix)
- ❌ `0712345678` (invalid length)
- ❌ `1234567` (no area code)

---

### 2. **NIC (National Identity Card)** ✅
**Two formats are accepted:**

#### Old Format:
- Pattern: `9 digits + V or X`
- Example: `123456789V`, `987654321X`
- Length: 10 characters

#### New Format:
- Pattern: `12 digits`
- Example: `199912345678`
- Typically starts with year: 1999, 2000, etc.
- Length: 12 characters

**Valid Examples:**
- ✅ `123456789V`
- ✅ `987654321X`
- ✅ `199912345678`
- ✅ `200001234567`

**Invalid Examples:**
- ❌ `123456789A` (wrong letter)
- ❌ `12345678V` (too few digits)
- ❌ `1234567890123` (too many digits)

---

### 3. **Names (First Name & Last Name)** ✅
**Updated to support Sri Lankan names:**

- Minimum: 2 characters
- Maximum: 50 characters
- Allowed characters:
  - Letters (A-Z, a-z)
  - Unicode letters (for Sinhala, Tamil characters if needed)
  - Spaces
  - Hyphens (-)
  - Apostrophes (')
  - Dots (.) for initials
  - Accented characters

**Valid Examples:**
- ✅ `John Smith`
- ✅ `Priya Kumari`
- ✅ `Jean-Paul`
- ✅ `O'Brien`
- ✅ `A. J. Silva`

---

### 4. **Email** ✓
- Standard email format validation
- Must contain @ symbol
- Must have domain extension (.com, .lk, etc.)
- Required field

**Valid Examples:**
- ✅ `john@example.com`
- ✅ `priya@company.lk`
- ✅ `user.name+tag@example.co.uk`

---

### 5. **Address** ✓
- Minimum: 5 characters
- Maximum: 200 characters
- No special format restrictions
- Optional field

**Valid Examples:**
- ✅ `123 Main Street, Colombo 07`
- ✅ `No. 45, Kandy Road, Peradeniya`
- ✅ `Apartment 5, Building A, Galle`

---

### 6. **Birthday** ✓
- Required field
- Must be 18+ years old
- Cannot be older than 120 years
- Format: YYYY-MM-DD

---

### 7. **Company Name** ✓
- Minimum: 2 characters
- Maximum: 100 characters
- Optional field

---

### 8. **Project Title** ✓
- Minimum: 3 characters
- Maximum: 100 characters
- Required field

---

### 9. **Project Description** ✓
- Minimum: 10 characters
- Maximum: 2000 characters
- Required field

---

### 10. **CV File** ✓
- Accepted formats: PDF, DOC, DOCX
- Maximum size: 5MB
- Optional field

---

## Implementation Details

### File Updated:
`src/utils/formValidation.js`

### Forms Using These Rules:
1. **EmployeeFormPage.jsx** - Employee Registration Form
2. **ClientFormPage.jsx** - Client Registration Form (Direct & Agent)

### Validation Trigger Points:
- **On Change**: If field already has an error, it re-validates while typing
- **On Blur**: Validates when user leaves the field (final validation)
- **On Submit**: Full form validation before submission
- **Email**: Additional server-side check for duplicate emails

---

## Example Valid Inputs

### Employee Registration Form:
```
First Name: John
Last Name: Silva
Phone: 0701234567 (or 0111234567)
NIC: 199912345678 (or 123456789V)
Email: john.silva@example.com
Birthday: 1999-12-15
Address: No. 45, Main Street, Colombo 07
CV: resume.pdf (under 5MB)
```

### Client Registration Form (Direct):
```
First Name: Priya
Last Name: Kumari
Phone: +94701234567
NIC: 987654321X
Email: priya@company.lk
Company: ABC Industries Ltd
Project Title: Building Valuation
Project Description: Complete structural valuation and assessment of commercial property at...
```

---

## Error Messages
Users will receive clear error messages:
- ❌ "Invalid Sri Lankan phone number. Use format: 0701234567, 0111234567, or +94701234567"
- ❌ "Invalid Sri Lankan NIC. Use old format (9 digits + V/X) or new format (12 digits)"
- ❌ "First Name must be at least 2 characters"
- etc.

---

## Notes
- All phone numbers are accepted with flexible formatting (spaces, hyphens, parentheses are removed before validation)
- NIC validation is case-insensitive (accepts both uppercase and lowercase V/X)
- All validations are performed client-side in real-time and server-side on submission
- International format phone numbers are automatically recognized
