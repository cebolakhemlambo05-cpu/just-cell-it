(function () {
  function emailJsReady() {
    const c = window.EMAILJS_CONFIG || {};
    return Boolean(window.emailjs && c.publicKey && c.serviceId && c.templateId && !c.publicKey.startsWith('YOUR_') && !c.serviceId.startsWith('YOUR_') && !c.templateId.startsWith('YOUR_'));
  }
  async function sendEmailJs(form) {
    if (!emailJsReady()) return false;
    const c = window.EMAILJS_CONFIG;
    await emailjs.sendForm(c.serviceId, c.templateId, form, { publicKey:c.publicKey });
    return true;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const form=document.getElementById('contact-form'); if(!form) return;
    const error=document.getElementById('contact-error'), success=document.getElementById('contact-success'), btn=document.getElementById('contact-submit');
    form.addEventListener('submit', async (event)=>{
      event.preventDefault(); error.classList.remove('show'); success.classList.remove('show'); btn.disabled=true; btn.textContent='Sending…';
      const payload={name:form.name.value.trim(),email:form.email.value.trim(),phone:form.phone.value.trim(),subject:form.subject.value,message:form.message.value.trim()};
      try { const sent=await sendEmailJs(form).catch(()=>false); await window.MOBILEHUB.apiFetch('/api/contact',{method:'POST',body:JSON.stringify(payload)}); success.textContent=sent?'Thanks. Your enquiry was sent to MobileHub.':'Thanks. Your enquiry was received.'; success.classList.add('show'); form.reset(); }
      catch(e){ error.textContent=e.message; error.classList.add('show'); }
      finally{ btn.disabled=false; btn.textContent='Send message'; }
    });
  });
})();
