// ============================================
// EmailJS Configuration
// ============================================
window.EMAILJS_CONFIG = {
  publicKey: 'Bks9rsSKCUPXt3gmF',
  serviceId: 'service_mofucjc',
  templateId: 'template_ur69x5u',
  toEmail: 'justcellitza826@gmail.com',
};

// ============================================
// API Configuration
// ============================================
const API_BASE_URL = 'https://just-cell-it-5.onrender.com';

// ============================================
// Contact Form Handler (Optional)
// ============================================
async function sendContactForm(formData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send message');
    }

    return data;
  } catch (error) {
    console.error('Contact form error:', error);
    throw error;
  }
}

// ============================================
// Export for use in other files
// ============================================
window.sendContactForm = sendContactForm;
window.API_BASE_URL = API_BASE_URL;