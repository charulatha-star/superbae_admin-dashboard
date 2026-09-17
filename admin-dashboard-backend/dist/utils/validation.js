"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEmail = isValidEmail;
/**
 * Validates email format using a simple regex pattern.
 * Allows common email formats (basic RFC 5322 compliance).
 */
function isValidEmail(email) {
    if (typeof email !== 'string')
        return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}
