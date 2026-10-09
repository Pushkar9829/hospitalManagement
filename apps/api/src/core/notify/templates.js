/**
 * SMS templates. In India every commercial SMS must use a DLT-registered template; `dltId` is
 * filled per hospital when its templates are approved (go-live checklist).
 */
export const SMS_TEMPLATES = Object.freeze({
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
