#!/usr/bin/env python3
"""Generates assets/formulaire.svg: a clean redrawing of the unified prescription form.

It is only the on-screen background of the preview and calibration screens (never printed).
The serial number, official seal, fiscal stamp and doctor's stamp are deliberately left as
empty placeholders: those belong to the real, numbered form.

Coordinates below are in the pixel grid the layout was measured on; the viewBox maps that
grid onto the paper (151 x 182 mm).
"""
from pathlib import Path

BLUE = "#2e3d8f"
FR = "Georgia, 'Times New Roman', 'Noto Serif', serif"
AR = "'Traditional Arabic', 'Geeza Pro', 'Noto Naskh Arabic', 'Noto Sans Arabic', Tahoma, Arial, sans-serif"
out = []


def line(x1, y1, x2, y2, w=2):
    out.append(f'<path d="M{x1} {y1}L{x2} {y2}" stroke-width="{w}"/>')


def rect(x, y, w, h, sw=2, extra=""):
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" stroke-width="{sw}" {extra}/>')


def fr(x, y, s, size=19, bold=False, anchor="start", extra=""):
    weight = ' font-weight="bold"' if bold else ""
    out.append(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}"{weight} {extra}>{s}</text>')


def ar(x, y, s, size=21, anchor="end", bold=False, extra=""):
    weight = ' font-weight="bold"' if bold else ""
    out.append(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-family="{AR}"{weight} {extra}>{s}</text>')


def two(x, y, a, b, size=19, bold=False, gap=25):
    fr(x, y, a, size, bold)
    fr(x, y + gap, b, size, bold)


def two_ar(x, y, a, b, size=20, gap=26):
    ar(x, y, a, size)
    ar(x, y + gap, b, size)


L, M, R = 105, 596, 1555  # left frame, column split, right frame
BOT = 1950

# ---------- Title and doctor's stamp box ----------
fr(697, 78, "Ordonnance Médicale", 36, True)
ar(1553, 80, "الوصفة الطبية الموحّدة", 38, bold=True)
rect(697, 100, 858, 163)

# ---------- Placeholders for what only the real form carries ----------
ph = 'stroke="#b9c0cc" stroke-dasharray="8 6"'
rect(115, 82, 370, 62, 2, ph)
out.append(f'<text x="300" y="121" font-size="20" text-anchor="middle" fill="#9aa3b2" stroke="none" font-family="Arial, sans-serif">N° de série</text>')
out.append(f'<circle cx="262" cy="265" r="74" stroke-width="2" {ph}/>')
out.append(f'<text x="262" y="272" font-size="18" text-anchor="middle" fill="#9aa3b2" stroke="none" font-family="Arial, sans-serif">sceau</text>')
rect(1312, 1766, 214, 170, 2, ph)
out.append(f'<text x="1419" y="1858" font-size="18" text-anchor="middle" fill="#9aa3b2" stroke="none" font-family="Arial, sans-serif">timbre</text>')

# ---------- Doctor's section (right) ----------
rect(M, 270, R - M, BOT - 270)
fr(612, 309, "Partie destinée au médecin traitant", 27, True)
ar(1535, 306, "حقل مخصّص للطبيب المعالج", 29, bold=True)
line(M, 325, R, 325, 1.5)
line(M, 330, R, 330, 1.5)

fr(610, 370, "Nom et prénom du patient", 20)
ar(1540, 362, "اسم وشهرة المريض", 21)
line(M, 380, R, 380)

fr(610, 425, "Date de Naissance", 20)
ar(1540, 418, "تاريخ الولادة", 21)
for x in (935, 1048, 1150, 1265):
    line(x, 380, x, 443)
line(M, 443, R, 443)

two(607, 473, "Durée d'arrêt", "de travail :", 18)
two_ar(1073, 468, "مدّة الانقطاع", "عن العمل:")
line(1078, 443, 1078, 622)
two(1095, 470, "Durée estimée", "du traitement :", 18)
two_ar(1535, 463, "المدة المقدرة", "للعلاج:")
line(M, 507, R, 507)
for x in (712, 790, 877, 967, 1177, 1255, 1337, 1416):
    line(x, 507, x, 622)
line(M, 565, R, 565)
line(M, 622, R, 622)

rows = [
    (648, "Nature de", "l'acte médical", "نوع العمل", "الطبّي", "Traitements effectués", "par le médecin :", "المعاملات التي", "أجراها الطبيب:", True),
    (707, "Frais de", "consultation", "بدل", "الأتعاب", "Ordonnance", "médicale Nbre", "وصفة", "طبية عدد", False),
    (760, "Frais de", "transport", "نفقات", "انتقال", "Une entente", "préalable", "موافقة", "مسبقة", False),
]
for y, a1, a2, b1, b2, c1, c2, d1, d2, bold in rows:
    two(605, y, a1, a2, 18)
    two_ar(1072, y - 4, b1, b2)
    two(1088, y - 5, c1, c2, 18, bold)
    two_ar(1535, y - 8, d1, d2)
line(1078, 622, 1078, 797)
for y in (683, 740, 797):
    line(M, y, R, y)

ar(1075, 823, "* الأدوية والعلاجات والفحوص الموصوفة", 24, anchor="middle", bold=True)
fr(1075, 850, "* Médicaments, traitements et examens médicaux prescrits", 24, True, "middle")
med_lines = [862, 967, 1078, 1190, 1300, 1412, 1524, 1637]
for y in med_lines:
    line(M, y, R, y)
for top, bottom in zip(med_lines, med_lines[1:]):
    rect(633, top + 7, 90, bottom - top - 13, 1.5)

fr(600, 1672, "Montant en lettres", 19)
ar(1138, 1672, "تفقيط المبلغ", 20)
line(1148, 1637, 1148, 1745)
fr(1158, 1672, "Reçu en espèce", 19)
ar(1535, 1672, "وصلنا المبلغ نقداً", 20)
line(M, 1745, R, 1745)

for i, s in enumerate(("Cachet et", "signature", "du médecin")):
    fr(602, 1780 + i * 27, s, 20)
for i, s in enumerate(("ختم ورقم اتفاقية", "الطبيب مع الجهة", "الضامنة وتوقيعه")):
    ar(1265, 1784 + i * 28, s, 21)
line(1280, 1745, 1280, BOT)

# ---------- Insurer / pharmacist section (left) ----------
rect(L, 385, M - L, BOT - 385)
fr(118, 425, "l'assurance", 27, True)
ar(575, 425, "الجهة الضامنة", 27, bold=True)
line(L, 447, M, 447)
line(L, 560, M, 560)
fr(113, 592, "Date", 18)
ar(575, 596, "التاريخ", 20)
for x in (233, 310, 386, 462):
    line(x, 560, x, 620)
line(L, 620, M, 620)
fr(110, 645, "Code de la maladie", 18)
ar(575, 646, "رمز المرض", 20)
line(L, 738, M, 738)

ar(340, 773, "حقل مخصّص", 27, anchor="middle", bold=True)
ar(340, 807, "للصيدلي/مختبر/أشعة", 27, anchor="middle", bold=True)
fr(340, 850, "Partie destinée", 26, True, "middle")
fr(340, 881, "au pharmacien/Labo/Radio", 26, True, "middle")
line(L, 905, M, 905)

for cx, a, f_ in ((190, "المجموع", "Total"), (338, "الكمية", "Quantité"), (493, "السعر الإفرادي", "Prix Unitaire")):
    ar(cx, 938, a, 18, anchor="middle")
    fr(cx, 961, f_, 18, False, "middle")
for y in (972, 1082, 1195, 1305, 1418, 1530, 1640):
    line(L, y, M, y)
line(290, 905, 290, 1640)
line(382, 905, 382, 1640)

line(378, 1640, 378, 1750)
ar(580, 1665, "المجموع", 19)
ar(580, 1690, "بالليرة اللبنانية", 19)
fr(580, 1714, "Total", 19, True, "end")
fr(580, 1738, "en livres libanaises", 19, True, "end")
line(L, 1750, M, 1750)

fr(113, 1790, "Date", 19, True)
ar(565, 1787, "التاريخ", 20)
for x in (225, 300, 375, 452):
    line(x, 1750, x, 1810)
line(L, 1810, M, 1810)
fr(108, 1838, "Cachet et signature du", 20, True)
fr(108, 1865, "pharmacien/Labo/Radio", 20, True)
ar(583, 1836, "ختم الصيدلي/ وتوقيعه/", 19)
ar(583, 1862, "مختبر/أشعة", 19)

# ---------- Side notes (rotated) and printer's credit ----------
note_fr = ("* Permet au pharmacien de substituer le médicament sauf marqué avec les lettres NS (Non Substituable) "
           "dans le cadre, conformément à l'article 47 de pratique de la profession de pharmacie au Liban après l'accord du patient.")
out.append(f'<text transform="translate(93 1945) rotate(-90)" font-size="13.5" textLength="1555" lengthAdjust="spacingAndGlyphs">{note_fr}</text>')
note_ar = ("* يُسمح للصيدلي باستبدال الدواء ما عدا المؤشر عليه بحرفي NS (Non Substituable) في المربع، "
           "عملاً بالمادة 47 من قانون مزاولة مهنة الصيدلة وبعد موافقة المريض.")
out.append(f'<text transform="translate(1592 392) rotate(-90)" font-size="21" text-anchor="start" direction="rtl" textLength="1540" lengthAdjust="spacingAndGlyphs" font-family="{AR}">{note_ar}</text>')
out.append('<text x="105" y="1972" font-size="13" font-family="Arial, sans-serif">Raidy | www.raidy.com</text>')

svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="151mm" height="182mm" viewBox="9.7 0 1608.3 1984" '
    f'preserveAspectRatio="none" fill="{BLUE}" stroke="none" font-family="{FR}">\n'
    '<rect x="0" y="0" width="1700" height="2000" fill="#fbfbf8"/>\n'
    f'<g fill="none" stroke="{BLUE}">\n'
    + "\n".join(o for o in out if o.startswith(("<path", "<rect", "<circle")))
    + "\n</g>\n"
    + "\n".join(o for o in out if o.startswith("<text"))
    + "\n</svg>\n"
)
target = Path(__file__).resolve().parent.parent / "assets" / "formulaire.svg"
target.write_text(svg, encoding="utf-8")
print(f"{target} ({len(svg)} bytes)")
