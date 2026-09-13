import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappDisplay } from './brand.ts';

test('رقم الواتساب يُنسَّق حسب رمز الدولة', () => {
  // رمز من ثلاثة أرقام — الرقم المعتمد
  assert.equal(whatsappDisplay('966534436932'), '+966 53 443 6932');
  assert.equal(whatsappDisplay('+966 534 436 932'), '+966 53 443 6932');
  // رمز من رقمين — الرقم التركي القديم يبقى صحيحاً
  assert.equal(whatsappDisplay('905013196750'), '+90 501 319 6750');
  // رمز غير معروف: بلا تقسيم بدل تقسيم خاطئ
  assert.equal(whatsappDisplay('971501234567'), '+971501234567');
});
