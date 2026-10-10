/**
 * SMS templates. In India every commercial SMS must use a DLT-registered template; `dltId` is
 * filled per hospital when its templates are approved (go-live checklist).
 */
export const SMS_TEMPLATES = Object.freeze({
  USER_INVITE: {
    dltId: '',
    text: {
      en: '{hospital} has created your staff login ({username}). Set your password within 72 hours: {link}',
      hi: '{hospital} ने आपका स्टाफ़ लॉगिन ({username}) बनाया है। 72 घंटे के अंदर पासवर्ड सेट करें: {link}',
    },
  },
  PASSWORD_RESET_OTP: {
    dltId: '',
    text: {
      en: '{code} is your password reset code for {hospital}. It expires in 5 minutes. If you did not ask for it, tell your admin.',
      hi: '{hospital} में पासवर्ड बदलने के लिए आपका कोड {code} है। यह 5 मिनट में समाप्त होगा। अगर आपने यह नहीं माँगा, तो अपने एडमिन को बताएँ।',
    },
  },
  LOGIN_OTP: {
    dltId: '',
    text: {
      en: '{code} is your sign-in code for {hospital}. It expires in 5 minutes. Do not share it.',
      hi: '{hospital} में साइन-इन के लिए आपका कोड {code} है। यह 5 मिनट में समाप्त होगा। इसे किसी से साझा न करें।',
    },
  },
});

export function renderTemplate(template, lang, vars) {
  const text = template.text[lang] ?? template.text.en;
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
