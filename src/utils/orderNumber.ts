// Generate order number in format DXN-YYYY-XXXXX
export const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  // Generate 5-digit sequence (could be stored in DB for persistence)
  const sequence = Math.floor(10000 + Math.random() * 89999);
  return `DXN-${year}-${sequence}`;
};

// Validate Algerian phone number
export const validateAlgerianPhone = (phone: string): boolean => {
  // Algerian phone format: +213 5XX XXX XXX or 05XX XXX XXX
  const cleaned = phone.replace(/\s+/g, "").replace(/^\+/, "");
  
  // Must start with 05 and be 10 digits
  const regex = /^05\d{8}$/;
  return regex.test(cleaned);
};

// Format phone number to Algerian format
export const formatAlgerianPhone = (phone: string): string => {
  const cleaned = phone.replace(/\s+/g, "").replace(/^\+/, "");
  
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    // Format: 05 XX XXX XXX
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  }
  
  return cleaned;
};

export default { generateOrderNumber, validateAlgerianPhone, formatAlgerianPhone };