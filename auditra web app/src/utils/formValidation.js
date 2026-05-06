/**
 * Form validation utility functions
 */

export const validationRules = {
  // Email validation
  email: {
    validate: (value) => {
      if (!value) return { valid: false, error: 'Email is required' };
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return { valid: false, error: 'Invalid email format' };
      return { valid: true };
    },
  },

  // Name validation (first/last) - Sri Lankan names support
  name: {
    validate: (value, fieldName = 'Name') => {
      if (!value) return { valid: false, error: `${fieldName} is required` };
      if (value.trim().length < 2) return { valid: false, error: `${fieldName} must be at least 2 characters` };
      if (value.trim().length > 50) return { valid: false, error: `${fieldName} must not exceed 50 characters` };
      // Allow letters (including accented), spaces, hyphens, apostrophes, and dots (for initials)
      if (!/^[a-zA-Z\s'-.\u0080-\uFFFF]+$/.test(value)) return { valid: false, error: `${fieldName} can only contain letters, spaces, hyphens, apostrophes, and dots` };
      return { valid: true };
    },
  },

  // Phone validation (Sri Lankan phone numbers)
  phone: {
    validate: (value) => {
      if (!value) return { valid: true }; // Optional field
      const cleanNumber = value.replace(/[\s\-()]/g, '');
      
      // Sri Lankan mobile: 070-079, 10 digits starting with 0
      // Sri Lankan landline: 011-012, 9-10 digits
      // International format: +94 followed by 9 digits (without leading 0)
      const sriLankanMobileRegex = /^0(70|71|75|76|77|78)[0-9]{7}$/;
      const sriLankanLandlineRegex = /^0(11|12|21|22|31|32|41|42|51|52|55|65|66|81|91)[0-9]{6,7}$/;
      const internationalRegex = /^\+94(70|71|75|76|77|78|11|12|21|22|31|32|41|42|51|52|55|65|66|81|91)[0-9]{6,7}$/;
      
      if (sriLankanMobileRegex.test(cleanNumber) || sriLankanLandlineRegex.test(cleanNumber) || internationalRegex.test(cleanNumber)) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Sri Lankan phone number. Use format: 0701234567, 0111234567, or +94701234567' };
    },
  },

  // NIC validation (Sri Lankan NIC formats)
  nic: {
    validate: (value) => {
      if (!value) return { valid: true }; // Optional field
      const cleanNIC = value.trim().toUpperCase();
      
      // Old format: 9 digits + V or X (e.g., 123456789V)
      const oldFormatRegex = /^[0-9]{9}[VX]$/;
      // New format: 12 digits (e.g., 199912345678)
      const newFormatRegex = /^[0-9]{12}$/;
      
      if (oldFormatRegex.test(cleanNIC) || newFormatRegex.test(cleanNIC)) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Sri Lankan NIC. Use old format (9 digits + V/X) or new format (12 digits)' };
    },
  },

  // Address validation
  address: {
    validate: (value) => {
      if (!value) return { valid: true }; // Optional field
      if (value.trim().length < 5) return { valid: false, error: 'Address must be at least 5 characters' };
      if (value.trim().length > 200) return { valid: false, error: 'Address must not exceed 200 characters' };
      return { valid: true };
    },
  },

  // Birthday validation (must be 18+ years old)
  birthday: {
    validate: (value) => {
      if (!value) return { valid: false, error: 'Birthday is required' };
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) return { valid: false, error: 'You must be at least 18 years old' };
      if (age > 120) return { valid: false, error: 'Invalid birthday' };
      return { valid: true };
    },
  },

  // Company name validation
  company_name: {
    validate: (value) => {
      if (!value) return { valid: true }; // Optional field
      if (value.trim().length < 2) return { valid: false, error: 'Company name must be at least 2 characters' };
      if (value.trim().length > 100) return { valid: false, error: 'Company name must not exceed 100 characters' };
      return { valid: true };
    },
  },

  // Project title validation
  project_title: {
    validate: (value) => {
      if (!value) return { valid: false, error: 'Project title is required' };
      if (value.trim().length < 3) return { valid: false, error: 'Project title must be at least 3 characters' };
      if (value.trim().length > 100) return { valid: false, error: 'Project title must not exceed 100 characters' };
      return { valid: true };
    },
  },

  // Project description validation
  project_description: {
    validate: (value) => {
      if (!value) return { valid: false, error: 'Project description is required' };
      if (value.trim().length < 10) return { valid: false, error: 'Project description must be at least 10 characters' };
      if (value.trim().length > 2000) return { valid: false, error: 'Project description must not exceed 2000 characters' };
      return { valid: true };
    },
  },

  // CV file validation
  cv_file: {
    validate: (file) => {
      if (!file) return { valid: true }; // Optional field
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) return { valid: false, error: 'CV file must not exceed 5MB' };
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) return { valid: false, error: 'Only PDF, DOC, DOCX files are allowed' };
      return { valid: true };
    },
  },
};

/**
 * Validate entire form object
 * @param {Object} data - Form data to validate
 * @param {Object} fieldRules - Object mapping field names to their validation rules
 * @returns {Object} - { isValid: boolean, errors: { field: 'error message' } }
 */
export const validateForm = (data, fieldRules) => {
  const errors = {};

  Object.entries(fieldRules).forEach(([field, rule]) => {
    const value = data[field];
    if (rule.validate) {
      const result = rule.validate(value, rule.label);
      if (!result.valid) {
        errors[field] = result.error;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate a single field
 * @param {string} fieldName - Field name
 * @param {any} value - Field value
 * @param {Object} rule - Validation rule object
 * @returns {Object} - { valid: boolean, error: 'error message' }
 */
export const validateField = (fieldName, value, rule) => {
  if (rule.validate) {
    return rule.validate(value, rule.label);
  }
  return { valid: true };
};
