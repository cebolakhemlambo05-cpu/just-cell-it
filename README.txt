MOBILEHUB - LOCAL SETUP

1. Backend
   cd backend
   npm install

2. Create backend/.env from backend/.env.example.
   The supplied admin credentials are:
     Email: mhub3580@gmail.com
     Password: admin123456

   These can be changed with ADMIN_EMAIL and ADMIN_PASSWORD in .env.

3. Start backend
   npm start

4. Serve frontend from a local web server (for example VS Code Live Server on port 5500).

LOGIN
The customer and admin use the SAME login page (login.html).
- mhub3580@gmail.com + admin123456 -> admin.html
- Any valid customer account -> catalog.html

ADMIN
The admin dashboard can manage products, orders and messages, and can delete customer accounts.
Admin accounts themselves cannot be deleted from the dashboard.

SECURITY
Do not publish your .env file or commit it to GitHub. Change the supplied admin password before putting the site into production.


WHATSAPP SETUP
---------------
Set WHATSAPP_NUMBER in backend/.env to your WhatsApp number in international format using digits only.
Example: a South African 082 123 4567 number becomes 27821234567.
The green WhatsApp icon appears on the customer-facing pages and opens a WhatsApp chat with a pre-filled message.
The same number is also used for the post-order WhatsApp/proof-of-payment button.

LOGO
----
The supplied MobileHub logo is stored at frontend/images/mobilehub-logo.jpeg and is used by the site header.
