# رفع البوابة إلى الإنترنت

دليل من ١٨ خطوة، لا يفترض خلفية تقنية. النسخة التفاعلية (بتتبّع التقدّم ونسخ
بضغطة) منشورة كـ Artifact؛ هذا الملف هو المرجع المكتوب داخل المستودع.

**الوقت:** ٤٥–٦٠ دقيقة · **الحسابات:** Supabase و GitHub و Vercel، كلها مجانية.

---

## قبل أن تبدأ — أمران

**قاعدة البيانات ليست اختيارية.** بدون Supabase سيُفتح الموقع، لكن الأصوات
والاقتراحات ستختفي بين طلب وآخر (لأن التخزين في ذاكرة العملية)، وتسجيل الدخول
معطّل تمامًا في الإنتاج. البيانات المحلية للتجربة على الجهاز فقط.

**ابدأ مجانًا، وارقِ عند الإطلاق.** نفّذ المراحل كلها على خطة Vercel Hobby
المجانية واختبر على الرابط المؤقت `.vercel.app`؛ لا شيء في المشروع يتصرّف بشكل
مختلف بين الخطتين. عندما تقرّر أن الصفحة جاهزة للعملاء، ارقِ إلى Pro ثم اربط
النطاق — الترقية على المشروع نفسه، بلا إعادة نشر ولا إعادة ضبط ولا تغيّر روابط.
السبب أن Hobby مخصّصة للاستخدام غير التجاري بحسب شروط Vercel: الاختبار الداخلي
ضمنها، وصفحة عامة لمنتج تجاري ليست كذلك.

وخطة Supabase Free تكفيك طويلًا؛ توقف المشروع مؤقتًا بعد سبعة أيام بلا نشاط
ويعود بضغطة.

---

## ١ · قاعدة البيانات (Supabase) — ١٥ دقيقة

1. **أنشئ مشروعًا** على [supabase.com](https://supabase.com) باسم `flovoo-roadmap`،
   منطقة `Central EU (Frankfurt)`. احفظ كلمة مرور قاعدة البيانات — لن تظهر ثانية.

2. **أنشئ الجداول.** من `SQL Editor` ← `New query`، الصق محتوى كل ملف واضغط
   `Run`، بهذا الترتيب تحديدًا وكل ملف في استعلام جديد:

   ```
   supabase/migrations/0001_init.sql
   supabase/migrations/0002_accounts.sql
   supabase/migrations/0003_changelog.sql
   supabase/migrations/0004_changelog_links.sql
   ```

   الملف الناجح يعطي `Success. No rows returned`.

3. **البيانات التجريبية (اختياري).** `supabase/seed.sql` يضيف ١٦ فكرة وثلاثة
   تحديثات. روابطه تشير إلى `help.flovoo.com` و`app.flovoo.com` وهي غير موجودة —
   عدّلها لاحقًا أو تخطَّ هذه الخطوة.

4. **انسخ المفاتيح** من `Project Settings` ← `API`: الـ `Project URL`،
   و`anon public`، و`service_role`.

   > **`service_role` يتجاوز كل الحمايات.** لا يُرسل في محادثة، ولا يُرفع إلى
   > GitHub، ولا يوضع في متغيّر يبدأ بـ `NEXT_PUBLIC_`. مكانه إعدادات Vercel فقط.

---

## ٢ · رفع الكود (GitHub) — ١٠ دقائق

5. **أنشئ مستودعًا** على [github.com/new](https://github.com/new) باسم
   `flovoo-roadmap`، نوعه **Private**. لا تفعّل `README` ولا `.gitignore` —
   المشروع يحملهما.

6. **ارفع المشروع.** من Terminal داخل مجلد المشروع، مع استبدال `USERNAME`:

   ```bash
   git add -A
   git commit -m "Flovoo roadmap portal"
   git branch -M main
   git remote add origin https://github.com/USERNAME/flovoo-roadmap.git
   git push -u origin main
   ```

---

## ٣ · النشر (Vercel) — ١٠ دقائق

7. **استورد المستودع** من [vercel.com](https://vercel.com) بحساب GitHub نفسه:
   `Add New` ← `Project` ← `Import`. سيُكتشف المشروع كـ Next.js تلقائيًا؛ لا
   تغيّر `Build Command` ولا `Output Directory`.

8. **أضف المتغيّرات الأربعة** في `Environment Variables`:

   | الاسم | القيمة |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role |
   | `ADMIN_EMAILS` | بريدك، وأكثر من واحد بفاصلة بينها |

   `ADMIN_EMAILS` هو ما يمنح صلاحية لوحة الإدارة. بدونه لا يدخلها أحد.

9. **اضغط Deploy.** دقيقتان تقريبًا، ثم رابط مثل `flovoo-roadmap.vercel.app`.
   لو فشل البناء فالسبب الأشيع مسافة زائدة في أحد المتغيّرات.

---

## ٤ · تسجيل الدخول — ١٠ دقائق

10. **عرّف Supabase على الرابط.** `Authentication` ← `URL Configuration`: ضع
    رابط Vercel في `Site URL`، وأضف عنوانين في `Redirect URLs`:

    ```
    https://flovoo-roadmap.vercel.app/ar/auth/callback
    https://flovoo-roadmap.vercel.app/en/auth/callback
    ```

11. **جوجل (اختياري).** من Google Cloud Console أنشئ `OAuth client ID` من نوع
    `Web application`، وضع في `Authorized redirect URIs` عنوان **Supabase** لا
    عنوان موقعك:

    ```
    https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
    ```

    ثم انسخ `Client ID` و`Client Secret` إلى `Authentication` ← `Providers` ←
    `Google`. الدخول بالبريد يعمل من دون هذه الخطوة.

12. **اضبط مرسل البريد.** الرابط السحري يُرسل عبر خادم Supabase التجريبي، وهو
    محدود بعدد قليل من الرسائل في الساعة. لموقع حقيقي: `Authentication` ←
    `Emails` ← `SMTP Settings` واربطه بمزوّد مثل Resend أو SES أو Postmark.

---

## ٥ · النطاق (اختياري) — ٥ دقائق

13. **أضف النطاق** في `Settings` ← `Domains`: `roadmap.flovoo.com`. النطاقات
    المخصّصة وشهادة HTTPS مجانية تقنيًا حتى في الخطة المجانية.

    > **نقطة التحوّل.** ربط نطاق الشركة يعني أن الصفحة صارت واجهة تجارية عامة،
    > وهو ما تستثنيه شروط Hobby. رقِّ إلى Pro قبل هذه الخطوة لا بعدها.

14. **أضف السجل** عند مزوّد النطاق:

    ```
    Type:  CNAME
    Name:  roadmap
    Value: cname.vercel-dns.com
    ```

15. **حدّث Supabase** بالنطاق الجديد في `Site URL` و`Redirect URLs`، مع إبقاء
    عنواني `.vercel.app` للاختبار.

---

## ٦ · التحقق — ٥ دقائق

16. **اختبار قاعدة البيانات، وهو الأهم.** صوّت لفكرة ثم **حدّث الصفحة**. بقاء
    الصوت يعني أن Supabase موصول. اختفاؤه يعني خطأ في أحد المتغيّرات — راجع
    الخطوة ٨ ثم `Deployments` ← `Redeploy`.

17. **قائمة الفحص:**

    - [ ] الصفحة تفتح بالعربية ومن اليمين إلى اليسار
    - [ ] مبدّل اللغة ينقلك إلى الإنجليزية ويحافظ على مكانك
    - [ ] الوضع الليلي يعمل بأوضاعه الثلاثة
    - [ ] تسجيل الدخول يعمل ويعود بك إلى الصفحة نفسها
    - [ ] اقتراح فكرة يصل إلى قائمة المراجعة في لوحة الإدارة
    - [ ] `/ar/admin` يفتح لك ويُمنع عن حساب آخر
    - [ ] تبويب «الجديد» يعرض التحديثات، و`/ar/updates/feed.xml` يفتح
    - [ ] الصفحة مرتّبة على الجوال بلا تمرير أفقي

18. **نظّف المحتوى التجريبي** إن شغّلت `seed.sql`: استبدل الروابط الوهمية من
    لوحة الإدارة، أو احذف ما لا يخصّك. بعدها فقط شارك الرابط.

---

## بعد النشر

كل `git push` إلى `main` يبني وينشر خلال دقيقتين. للتراجع: `Deployments` ثم
`Promote to Production` على النسخة السابقة.

**ناقص عن قصد:** إرسال بريد الإشعارات. عند نقل فكرة إلى «تم الإطلاق» تُسجَّل
الإشعارات في `notification_outbox` بشكل صحيح، لكن لا شيء يقرأ الجدول ويرسل بعد —
يحتاج ربط مزوّد بريد، وهو عمل منفصل.
