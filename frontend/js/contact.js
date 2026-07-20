async function handleContactSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('contact-form');
  const errorBox = document.getElementById('contact-error');
  const successBox = document.getElementById('contact-success');
  const submitBtn = document.getElementById('contact-submit');

  errorBox.classList.remove('show');
  successBox.classList.remove('show');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    subject: form.subject.value,
    message: form.message.value.trim(),
  };

  try {
    const sentWithEmailJs = await sendWithEmailJs(form);

    const response = await apiFetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({ ...payload, skipEmail: sentWithEmailJs }),
    });

    successBox.textContent = sentWithEmailJs
      ? 'Thanks. Your enquiry was sent to Just Cell It.'
      : response.message;
    successBox.classList.add('show');
    form.reset();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.add('show');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send message';
  }
}

function isEmailJsReady() {
  const config = window.EMAILJS_CONFIG || {};
  return Boolean(
    window.emailjs
      && config.publicKey
      && config.serviceId
      && config.templateId
      && !config.publicKey.startsWith('YOUR_')
      && !config.serviceId.startsWith('YOUR_')
      && !config.templateId.startsWith('YOUR_')
  );
}

async function sendWithEmailJs(form) {
  if (!isEmailJsReady()) return false;

  const config = window.EMAILJS_CONFIG;
  await emailjs.sendForm(config.serviceId, config.templateId, form, {
    publicKey: config.publicKey,
  });
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (form) form.addEventListener('submit', handleContactSubmit);
});
