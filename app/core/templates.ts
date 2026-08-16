export type TemplateId = "light-commerce" | "dark-native" | "gradient-mixed";

export interface EmailTemplate {
  id: TemplateId;
  name: string;
  label: string;
  html: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "light-commerce",
    name: "Commerce receipt",
    label: "Light native",
    html: `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width">
  <style>
    body { margin: 0; background: #f4f1eb; color: #202124; font-family: Arial, sans-serif; }
    .shell { width: 100%; background: #f4f1eb; padding: 28px 12px; }
    .card { width: 100%; max-width: 560px; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 35px rgba(36,30,20,.12); }
    .header { background: #ffdd66; color: #241d0c; padding: 34px; }
    .eyebrow { color: #725b00; font-size: 12px; font-weight: bold; letter-spacing: 1.8px; }
    .content { padding: 32px; }
    .total { background: #f6f8fa; border: 1px solid #e2e5e9; border-radius: 12px; padding: 18px; }
    .button { display: inline-block; background: #1769e0; color: #ffffff; padding: 13px 20px; border-radius: 999px; text-decoration: none; font-weight: bold; }
    .muted { color: #69717c; font-size: 13px; }
  </style>
</head>
<body>
  <table role="presentation" class="shell" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" class="card" cellpadding="0" cellspacing="0">
      <tr><td class="header"><div class="eyebrow">NORTH &amp; PINE</div><h1 style="margin:10px 0 0;font-size:34px;line-height:1.1">Your order is on its way.</h1></td></tr>
      <tr><td class="content">
        <p style="margin-top:0;font-size:17px;line-height:1.6">Hi Maya, we packed the good stuff. Your parcel should arrive on Thursday.</p>
        <table role="presentation" width="100%" class="total"><tr><td><strong>Canvas weekender</strong><br><span class="muted">Sand · Qty 1</span></td><td align="right"><strong>$84.00</strong></td></tr></table>
        <p style="margin:26px 0"><a class="button" href="https://example.com">Track package</a></p>
        <p class="muted" style="margin-bottom:0">Order NP-1048 · Shipped with Parcel Post</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
  },
  {
    id: "dark-native",
    name: "Night launch",
    label: "Dark native",
    html: `<!doctype html>
<html>
<head>
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <style>
    body { margin: 0; background: #080a0f; color: #f4f6fb; font-family: Arial, sans-serif; }
    .shell { width: 100%; background: #080a0f; padding: 30px 12px; }
    .card { width: 100%; max-width: 560px; background: #121620; border: 1px solid #2a3040; border-radius: 22px; overflow: hidden; }
    .hero { padding: 46px 34px; background: #171c28; }
    .signal { color: #74f4bc; font-size: 12px; letter-spacing: 2px; font-weight: bold; }
    .copy { color: #b9c0ce; line-height: 1.7; }
    .button { display:inline-block;background:#74f4bc;color:#07110d;padding:13px 21px;border-radius:8px;text-decoration:none;font-weight:bold; }
    .panel { background:#0d1119;border-left:3px solid #74f4bc;padding:18px;margin:24px 0;color:#e9edf5; }
  </style>
</head>
<body>
  <table role="presentation" class="shell" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" class="card" cellpadding="0" cellspacing="0">
      <tr><td class="hero">
        <div class="signal">ORBITAL / 07</div>
        <h1 style="font-size:42px;line-height:1.02;margin:14px 0;color:#ffffff">Built for<br>after dark.</h1>
        <p class="copy">A product launch authored in dark colors from the start—no white canvas and no light-mode assumptions.</p>
        <div class="panel"><strong>Live window</strong><br><span style="color:#9da7b8">21:00 UTC · Studio channel</span></div>
        <a class="button" href="https://example.com">Enter the launch</a>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
  },
  {
    id: "gradient-mixed",
    name: "Gradient field test",
    label: "Mixed + gradients",
    html: `<!doctype html>
<html>
<head>
  <style>
    body { margin:0; background:#eef1f7; color:#15213b; font-family:Arial,sans-serif; }
    .shell { width:100%; padding:28px 12px; background:linear-gradient(135deg,#e9edff 0%,#fff2e8 52%,#edfaff 100%); }
    .card { width:100%; max-width:560px; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 18px 55px rgba(35,45,75,.18); }
    .hero { padding:52px 34px; color:#ffffff; background:linear-gradient(125deg,#5b2cff 0%,#d52aa8 46%,#ff7246 100%); }
    .orb { height:10px; border-radius:999px; background:repeating-linear-gradient(90deg,#86ffdb 0,#86ffdb 22px,rgba(255,255,255,.28) 22px,rgba(255,255,255,.28) 34px); }
    .content { padding:32px; }
    .dark-card { background:radial-gradient(circle at top right,#28375f 0%,#111727 64%); color:#f7f9ff; border-radius:16px; padding:24px; }
    .light-card { margin-top:14px;background:#fff7d6;color:#342b0b;border:1px solid #f1d86b;border-radius:16px;padding:20px; }
    .button { display:inline-block;background:#111827;color:white;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold; }
  </style>
</head>
<body>
  <table role="presentation" class="shell" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" class="card" cellpadding="0" cellspacing="0">
      <tr><td class="hero"><div class="orb"></div><h1 style="font-size:38px;margin:24px 0 10px">Color, under pressure.</h1><p style="margin:0;line-height:1.6;color:rgba(255,255,255,.86)">Multiple stops, transparency and mixed surfaces in one controlled email.</p></td></tr>
      <tr><td class="content">
        <div class="dark-card"><strong>Already dark</strong><p style="color:#bac5dc;margin-bottom:0;line-height:1.6">This panel should remain intentional—not be inverted back into a light card.</p></div>
        <div class="light-card"><strong>Deliberately light</strong><p style="margin-bottom:0">The same email contains a pale information surface.</p></div>
        <p style="margin:24px 0 0"><a class="button" href="https://example.com">Inspect the palette</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
  },
];

export const DEFAULT_TEMPLATE = EMAIL_TEMPLATES[2];
