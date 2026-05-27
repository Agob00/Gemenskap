"""
Genererar en PDF-rapport (docs/ml-forklaring.pdf) som förklarar hur
ML i Gemenskap fungerar. Använder reportlab + matplotlib för figurer.
"""

import os
import json
from io import BytesIO

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak,
    Table, TableStyle, KeepTogether,
)


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_PDF = os.path.join(HERE, "ml-forklaring.pdf")
FIG_DIR = os.path.join(HERE, "figures")
os.makedirs(FIG_DIR, exist_ok=True)


# ── Färgschema (matchar Gemenskap-temat ungefär) ──
COLOR_PRIMARY = "#2E7D5E"      # mörkgrön
COLOR_ACCENT  = "#E67E22"      # varm orange
COLOR_BG      = "#F5F1E8"      # ljus bakgrund
COLOR_INK     = "#1E2A24"      # nästan svart
COLOR_MUTED   = "#666666"


# ─────────────────────────────────────────────────────────
# Figurer
# ─────────────────────────────────────────────────────────

def fig_pipeline():
    """Översiktsbild: offline-pipelinen + runtime-flödet."""
    fig, ax = plt.subplots(figsize=(10, 5.5))
    ax.set_xlim(0, 10); ax.set_ylim(0, 7); ax.axis("off")

    # Offline-rad
    offline_y = 5
    offline_steps = [
        ("1500 syntetiska\nanvändare", 0.5),
        ("Persona-baserad\nintresse-sampling", 2.4),
        ("DBSCAN per stad\n(Jaccard-avstånd)", 4.4),
        ("Splitta kluster\n> 40 medlemmar", 6.4),
        ("Namnge kluster\n→ communities", 8.4),
    ]
    for label, x in offline_steps:
        box = FancyBboxPatch((x - 0.7, offline_y - 0.6), 1.7, 1.2,
                              boxstyle="round,pad=0.04", linewidth=1.4,
                              edgecolor=COLOR_PRIMARY, facecolor="#E8F2EC")
        ax.add_patch(box)
        ax.text(x + 0.15, offline_y, label, ha="center", va="center",
                fontsize=8.5, color=COLOR_INK)

    for i in range(len(offline_steps) - 1):
        x1 = offline_steps[i][1] + 1.0
        x2 = offline_steps[i + 1][1] - 0.7
        ax.annotate("", xy=(x2, offline_y), xytext=(x1, offline_y),
                    arrowprops=dict(arrowstyle="->", lw=1.4, color=COLOR_PRIMARY))

    ax.text(5, 6.5, "OFFLINE  ·  körs en gång per datauppdatering",
            ha="center", fontsize=11, weight="bold", color=COLOR_PRIMARY)

    # Runtime-rad
    runtime_y = 1.8
    runtime_steps = [
        ("Ny användare\nanger intressen", 0.7),
        ("Filtrera bort\nfulla & avvisade", 3.0),
        ("Viktad Jaccard\n+ stadspoäng", 5.4),
        ("Tilldela bästa\nkluster", 7.8),
    ]
    for label, x in runtime_steps:
        box = FancyBboxPatch((x - 0.7, runtime_y - 0.55), 1.7, 1.1,
                              boxstyle="round,pad=0.04", linewidth=1.4,
                              edgecolor=COLOR_ACCENT, facecolor="#FCEBD8")
        ax.add_patch(box)
        ax.text(x + 0.15, runtime_y, label, ha="center", va="center",
                fontsize=8.5, color=COLOR_INK)

    for i in range(len(runtime_steps) - 1):
        x1 = runtime_steps[i][1] + 1.0
        x2 = runtime_steps[i + 1][1] - 0.7
        ax.annotate("", xy=(x2, runtime_y), xytext=(x1, runtime_y),
                    arrowprops=dict(arrowstyle="->", lw=1.4, color=COLOR_ACCENT))

    ax.text(5, 3.2, "RUNTIME  ·  körs vid varje ny registrering / leave-reassign",
            ha="center", fontsize=11, weight="bold", color=COLOR_ACCENT)

    # Koppling offline → runtime
    ax.annotate("", xy=(5, 2.5), xytext=(5, 4.3),
                arrowprops=dict(arrowstyle="->", lw=2.0, color=COLOR_MUTED,
                                linestyle="--"))
    ax.text(5.6, 3.8, "88 communities\nläses från DB", ha="left", va="center",
            fontsize=8, color=COLOR_MUTED, style="italic")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "pipeline.png")
    fig.savefig(path, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def fig_jaccard_demo():
    """Visa viktad Jaccard med ett konkret exempel."""
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.set_xlim(0, 10); ax.set_ylim(0, 4.2); ax.axis("off")

    # Venn-liknande layout
    user_items = [("Schack", 1.0), ("Bridge", 1.0), ("Fika", 0.5)]
    comm_items = [("Schack", 1.0), ("Kortspel", 1.0), ("Korsord", 1.0), ("Fika", 0.5)]
    shared = [it for (it, _) in user_items if it in [c for (c, _) in comm_items]]

    # Användare
    ax.add_patch(plt.Circle((2.5, 2), 1.4, alpha=0.30, color=COLOR_PRIMARY))
    ax.text(2.5, 3.7, "Användarens\nintressen",
            ha="center", fontsize=10, weight="bold", color=COLOR_PRIMARY)
    user_only = [it for (it, _) in user_items if it not in shared]
    for i, item in enumerate(user_only):
        ax.text(1.9, 2.3 - i * 0.4, item, ha="center", fontsize=9)

    # Grupp
    ax.add_patch(plt.Circle((6.5, 2), 1.6, alpha=0.30, color=COLOR_ACCENT))
    ax.text(6.5, 3.85, "Gruppens\nintressen",
            ha="center", fontsize=10, weight="bold", color=COLOR_ACCENT)
    comm_only = [it for (it, _) in comm_items if it not in shared]
    for i, item in enumerate(comm_only):
        ax.text(7.1, 2.3 - i * 0.4, item, ha="center", fontsize=9)

    # Gemensamt
    for i, item in enumerate(shared):
        ax.text(4.5, 2.2 - i * 0.4, item, ha="center", fontsize=9, weight="bold")

    # Beräkningsbox
    ax.text(0.2, 0.55, "Viktad Jaccard:", fontsize=9, weight="bold")
    ax.text(0.2, 0.15,
            "interW = 1.0 (Schack) + 0.5 (Fika) = 1.5",
            fontsize=9, family="monospace")
    ax.text(5.5, 0.55, "unionW = alla unika intressen, viktade",
            fontsize=9)
    ax.text(5.5, 0.15,
            "= 1.0+1.0+1.0+1.0+0.5 + 0.0 = 4.5  →  score = 1.5/4.5 ≈ 0.33",
            fontsize=9, family="monospace")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "jaccard.png")
    fig.savefig(path, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def fig_dbscan_toy():
    """Liten DBSCAN-visualisering på 2D-projektion av riktig data."""
    # Läs in datasetet och visa kluster för Stockholm i 2D via MDS-likt
    with open(os.path.join(ROOT, "data", "dataset.json"), encoding="utf-8") as f:
        ds = json.load(f)

    sthlm_users = [u for u in ds["users"] if u["city"] == "Stockholm"][:140]
    sthlm_comms = [c for c in ds["communities"] if c["city"] == "Stockholm"]

    # Skapa intresse-vokab
    vocab = sorted({i for u in sthlm_users for i in u["interests"]})
    idx = {v: i for i, v in enumerate(vocab)}
    X = np.zeros((len(sthlm_users), len(vocab)))
    for r, u in enumerate(sthlm_users):
        for it in u["interests"]:
            X[r, idx[it]] = 1

    # Jaccard avstånds-matris
    n = len(sthlm_users)
    D = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            inter = float(np.sum(np.logical_and(X[i], X[j])))
            union = float(np.sum(np.logical_or(X[i], X[j])))
            D[i, j] = 1 - (inter / union if union > 0 else 1)

    # Klassisk metric-MDS via dubbelcentrering
    n = D.shape[0]
    J = np.eye(n) - np.ones((n, n)) / n
    B = -0.5 * J @ (D ** 2) @ J
    vals, vecs = np.linalg.eigh(B)
    order = np.argsort(-vals)
    coords = vecs[:, order[:2]] * np.sqrt(np.maximum(vals[order[:2]], 0))

    # Tilldela varje användare till deras community via memberships
    memberships = {m["userId"]: m["communityId"] for m in ds["memberships"]}
    user_to_color = {}
    for u in sthlm_users:
        cid = memberships.get(u["id"])
        user_to_color[u["id"]] = cid

    fig, ax = plt.subplots(figsize=(9, 6))
    cids = sorted({user_to_color[u["id"]] for u in sthlm_users
                   if user_to_color[u["id"]] is not None})
    cmap = plt.cm.tab20(np.linspace(0, 1, max(len(cids), 1)))
    cid_to_color = {cid: cmap[i] for i, cid in enumerate(cids)}

    for i, u in enumerate(sthlm_users):
        cid = user_to_color[u["id"]]
        c = cid_to_color.get(cid, (0.5, 0.5, 0.5, 1))
        ax.scatter(coords[i, 0], coords[i, 1], c=[c], s=60, alpha=0.75,
                   edgecolors="white", linewidths=0.7)

    # Annotera de största kluster-namnen vid sina centroider
    for cid in cids[:8]:
        comm = next((c for c in sthlm_comms if c["id"] == cid), None)
        if not comm:
            continue
        members = [coords[i] for i, u in enumerate(sthlm_users)
                   if user_to_color[u["id"]] == cid]
        if len(members) < 3:
            continue
        cx = float(np.mean([m[0] for m in members]))
        cy = float(np.mean([m[1] for m in members]))
        ax.annotate(comm["name"], (cx, cy), fontsize=8,
                    weight="bold", ha="center",
                    bbox=dict(boxstyle="round,pad=0.25", facecolor="white",
                              edgecolor=COLOR_INK, alpha=0.85))

    ax.set_title("DBSCAN-kluster i Stockholm projicerade till 2D (MDS)",
                 fontsize=11, color=COLOR_INK, pad=12)
    ax.set_xlabel("MDS axel 1", fontsize=9)
    ax.set_ylabel("MDS axel 2", fontsize=9)
    ax.grid(alpha=0.2)
    plt.tight_layout()
    path = os.path.join(FIG_DIR, "dbscan_clusters.png")
    fig.savefig(path, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def fig_score_breakdown():
    """Stapeldiagram: jaccard*0.7 + cityScore*0.3 för fyra exempelkandidater."""
    candidates = [
        ("Spelgrupp\nStockholm",    0.67, 1.00),
        ("Trädgård\nStockholm",     0.20, 1.00),
        ("Spelgrupp\nGöteborg",     0.67, 0.55),
        ("Yoga\nStockholm",         0.10, 1.00),
    ]
    fig, ax = plt.subplots(figsize=(9, 4.8))
    xs = np.arange(len(candidates))
    jacc_part = [c[1] * 0.7 for c in candidates]
    city_part = [c[2] * 0.3 for c in candidates]

    ax.bar(xs, jacc_part, color=COLOR_PRIMARY, label="Jaccard × 0.7")
    ax.bar(xs, city_part, bottom=jacc_part, color=COLOR_ACCENT,
           label="Stadspoäng × 0.3")

    for i, (label, j, cs) in enumerate(candidates):
        total = j * 0.7 + cs * 0.3
        ax.text(i, total + 0.02, f"{total:.2f}",
                ha="center", fontsize=10, weight="bold")

    ax.set_xticks(xs)
    ax.set_xticklabels([c[0] for c in candidates], fontsize=9)
    ax.set_ylabel("Slutpoäng (0–1)", fontsize=10)
    ax.set_ylim(0, 1.05)
    ax.set_title("Poängsättning av fyra kandidatgrupper för\nMaj (Stockholm, intressen: Schack, Bridge, Kortspel)",
                 fontsize=11, pad=12)
    ax.legend(loc="lower right", fontsize=9)
    ax.grid(axis="y", alpha=0.25)
    plt.tight_layout()
    path = os.path.join(FIG_DIR, "score_breakdown.png")
    fig.savefig(path, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def fig_cluster_sizes():
    """Histogram över klusterstorlekar i datasetet."""
    with open(os.path.join(ROOT, "data", "dataset.json"), encoding="utf-8") as f:
        ds = json.load(f)
    sizes = {}
    for m in ds["memberships"]:
        sizes[m["communityId"]] = sizes.get(m["communityId"], 0) + 1
    counts = list(sizes.values())
    fig, ax = plt.subplots(figsize=(8.5, 4))
    ax.hist(counts, bins=np.arange(0, 45, 2), color=COLOR_PRIMARY,
            edgecolor="white", alpha=0.85)
    ax.axvline(40, color=COLOR_ACCENT, linewidth=2, linestyle="--",
               label="MAX_MEMBERS = 40")
    ax.set_xlabel("Antal medlemmar per grupp", fontsize=10)
    ax.set_ylabel("Antal grupper", fontsize=10)
    ax.set_title(f"Distribution av klusterstorlekar (totalt {len(counts)} grupper)",
                 fontsize=11, pad=10)
    ax.legend(fontsize=9)
    ax.grid(axis="y", alpha=0.25)
    plt.tight_layout()
    path = os.path.join(FIG_DIR, "cluster_sizes.png")
    fig.savefig(path, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


# ─────────────────────────────────────────────────────────
# PDF
# ─────────────────────────────────────────────────────────

def build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="GmTitle", fontSize=26, leading=30, textColor=HexColor(COLOR_PRIMARY),
        spaceAfter=14, fontName="Helvetica-Bold", alignment=TA_LEFT))
    styles.add(ParagraphStyle(
        name="GmSubtitle", fontSize=14, leading=18, textColor=HexColor(COLOR_MUTED),
        spaceAfter=22, fontName="Helvetica"))
    styles.add(ParagraphStyle(
        name="GmH1", fontSize=18, leading=22, textColor=HexColor(COLOR_PRIMARY),
        spaceAfter=10, spaceBefore=14, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(
        name="GmH2", fontSize=13, leading=17, textColor=HexColor(COLOR_INK),
        spaceAfter=6, spaceBefore=10, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(
        name="GmBody", fontSize=10.5, leading=15, textColor=HexColor(COLOR_INK),
        spaceAfter=8, fontName="Helvetica"))
    styles.add(ParagraphStyle(
        name="GmBullet", fontSize=10.5, leading=15, textColor=HexColor(COLOR_INK),
        spaceAfter=4, leftIndent=14, bulletIndent=2, fontName="Helvetica"))
    styles.add(ParagraphStyle(
        name="GmCode", fontSize=9, leading=12, textColor=HexColor(COLOR_INK),
        backColor=HexColor("#F0EAD6"), borderColor=HexColor("#D6CFB8"),
        borderPadding=8, borderWidth=0.5, spaceBefore=4, spaceAfter=10,
        fontName="Courier"))
    styles.add(ParagraphStyle(
        name="GmCaption", fontSize=9, leading=12, textColor=HexColor(COLOR_MUTED),
        alignment=TA_CENTER, spaceAfter=14, fontName="Helvetica-Oblique"))
    return styles


def P(text, style, **kwargs):
    return Paragraph(text, style, **kwargs)


def make_pdf():
    pipeline_png       = fig_pipeline()
    jaccard_png        = fig_jaccard_demo()
    dbscan_png         = fig_dbscan_toy()
    score_png          = fig_score_breakdown()
    sizes_png          = fig_cluster_sizes()

    doc = SimpleDocTemplate(
        OUT_PDF, pagesize=A4,
        leftMargin=2.0 * cm, rightMargin=2.0 * cm,
        topMargin=2.0 * cm, bottomMargin=2.0 * cm,
        title="Gemenskap — så fungerar ML",
        author="Gemenskap",
    )
    s = build_styles()
    story = []

    # ── Försättsblad ──
    story.append(Spacer(1, 4 * cm))
    story.append(P("Hur ML fungerar i Gemenskap", s["GmTitle"]))
    story.append(P(
        "Klusterbaserad gruppmatchning byggd på DBSCAN och viktad "
        "Jaccard-likhet — en teknisk genomgång av offline-pipelinen, "
        "runtime-tilldelningen och den kontinuerliga omvärderingen.",
        s["GmSubtitle"]))
    story.append(Spacer(1, 1 * cm))
    info_table = Table([
        ["Dataset",     "1500 syntetiska användare över 9 städer"],
        ["Communities", "88 DBSCAN-genererade kluster"],
        ["Intressen",   "34 stycken i 6 kategorier"],
        ["Max per grupp", "40 medlemmar"],
        ["Likhetsmått", "Viktad Jaccard (generiska intressen 0.5×)"],
    ], colWidths=[4.5 * cm, 11 * cm])
    info_table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10.5),
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 10.5),
        ("TEXTCOLOR", (0, 0), (0, -1), HexColor(COLOR_PRIMARY)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, HexColor("#DDDDDD")),
    ]))
    story.append(info_table)
    story.append(PageBreak())

    # ── 1. Översikt ──
    story.append(P("1. Översikt", s["GmH1"]))
    story.append(P(
        "Gemenskap använder ML för att tilldela varje ny användare till en "
        "befintlig grupp som matchar hens intressen och stad. Det är inte "
        "ett neuralt nätverk och inte en LLM. Det är en pipeline i två steg:",
        s["GmBody"]))
    story.append(P(
        "<b>Offline:</b> grupperna bildas en gång genom att köra DBSCAN på "
        "syntetiska användarprofiler. Resultatet — 88 kluster — sparas i SQLite.",
        s["GmBullet"], bulletText="•"))
    story.append(P(
        "<b>Runtime:</b> när någon registrerar sig poängsätts alla existerande "
        "grupper mot hens intressen och stad. Den högst rankade gruppen tilldelas.",
        s["GmBullet"], bulletText="•"))

    story.append(Image(pipeline_png, width=16 * cm, height=8.5 * cm))
    story.append(P(
        "Figur 1. Två-stegs-pipelinen: offline-klustring (grön) bildar grupper "
        "en gång; runtime-tilldelning (orange) väljer bland dem vid varje "
        "registrering.", s["GmCaption"]))

    story.append(P(
        "Vinsten med att klustra <i>offline</i> är två: matchningen blir "
        "deterministisk (samma profil ger samma grupp varje gång), och "
        "servern behöver inte träna något vid uppstart. Runtime-koden gör "
        "bara enkla mängdjämförelser och avståndsmått.",
        s["GmBody"]))
    story.append(PageBreak())

    # ── 2. Viktad Jaccard ──
    story.append(P("2. Likhetsmåttet — viktad Jaccard", s["GmH1"]))
    story.append(P(
        "Vi mäter \"hur lika är två intresseuppsättningar\" med Jaccard-index: "
        "andelen gemensamma intressen av alla unika intressen totalt. "
        "Värdet ligger mellan 0 (inget gemensamt) och 1 (identiska).",
        s["GmBody"]))
    story.append(P(
        "<b>Viktningen:</b> tre generiska intressen "
        "(<i>Promenader</i>, <i>Fika</i>, <i>Resor</i>) får halverad vikt. "
        "Skälet: nästan alla seniorer tycker om åtminstone en av dessa, så "
        "ett delat \"Fika\" ska inte väga lika mycket som ett delat \"Schack\".",
        s["GmBody"]))

    story.append(Image(jaccard_png, width=16 * cm, height=6.4 * cm))
    story.append(P(
        "Figur 2. Beräkning av viktad Jaccard mellan en användare och en "
        "grupp. Schack och Fika är gemensamma; Fika räknas till halva vikten.",
        s["GmCaption"]))

    story.append(P("Implementationen i [server/ml.js](server/ml.js):", s["GmH2"]))
    story.append(P(
        "function weightedJaccard(user, community) {<br/>"
        "&nbsp;&nbsp;let interW = 0, unionW = 0;<br/>"
        "&nbsp;&nbsp;for (const it of user) {<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;const w = GENERIC.has(it) ? 0.5 : 1.0;<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;if (community.has(it)) interW += w;<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;unionW += w;<br/>"
        "&nbsp;&nbsp;}<br/>"
        "&nbsp;&nbsp;for (const it of community) if (!user.has(it))<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;unionW += GENERIC.has(it) ? 0.5 : 1.0;<br/>"
        "&nbsp;&nbsp;return interW / unionW;<br/>"
        "}", s["GmCode"]))
    story.append(PageBreak())

    # ── 3. Offline-klustring (DBSCAN) ──
    story.append(P("3. Offline-pipelinen — så bildas grupperna", s["GmH1"]))
    story.append(P(
        "Skriptet <i>scripts/generate-synthetic-dataset.js</i> kör fem steg "
        "för att bygga datasetet. Vi tittar på vart och ett.",
        s["GmBody"]))

    story.append(P("3.1 Syntetiska användare via personas", s["GmH2"]))
    story.append(P(
        "1500 användare genereras med en deterministisk PRNG (seed = 1337). "
        "Varje användare får 1 primär persona — t.ex. <i>walker</i>, "
        "<i>reader</i>, <i>cook</i>, <i>gardener</i> — som styr 3–5 av "
        "intressen. 50 % av användarna får dessutom en sekundär persona "
        "(1–2 extra intressen). Personerna är realistiska grupperingar:",
        s["GmBody"]))
    story.append(P("• <b>walker</b>: Promenader, Vandring, Fågelskådning, Cykling, Fika", s["GmBullet"]))
    story.append(P("• <b>reader</b>: Bokläsning, Filmklubb, Teater, Historia, Museum", s["GmBullet"]))
    story.append(P("• <b>cook</b>: Matlagning, Bakning, Vinprovning, Fika", s["GmBullet"]))
    story.append(P("• <b>gamer</b>: Schack, Bridge, Kortspel, Korsord", s["GmBullet"]))
    story.append(P("• <b>wellness</b>: Yoga, Pilates, Meditation, Simning", s["GmBullet"]))
    story.append(P(
        "Det här ger en distribution som liknar vad man kan förvänta sig i "
        "verkligheten — koherenta intresseuppsättningar snarare än "
        "slumpmässiga vektorer.",
        s["GmBody"]))

    story.append(P("3.2 DBSCAN per stad", s["GmH2"]))
    story.append(P(
        "För varje av de 9 städerna kör vi DBSCAN på användarna i den staden. "
        "Avståndsmåttet är <i>1 − Jaccard</i> (oviktad här, så algoritmen blir "
        "stadsneutral). Parametrarna är inställda per stad:",
        s["GmBody"]))

    dbscan_tbl = Table([
        ["Stad",        "eps",  "minSamples"],
        ["Stockholm",   "0.38", "3"],
        ["Göteborg",    "0.42", "3"],
        ["Malmö",       "0.42", "3"],
        ["Uppsala",     "0.45", "3"],
        ["Övriga 5",    "0.48", "3"],
    ], colWidths=[4 * cm, 3 * cm, 3 * cm])
    dbscan_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9.5),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#FFFFFF")),
        ("BACKGROUND", (0, 0), (-1, 0), HexColor(COLOR_PRIMARY)),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HexColor("#CCCCCC")),
    ]))
    story.append(dbscan_tbl)
    story.append(Spacer(1, 0.3 * cm))
    story.append(P(
        "Stockholm har snävare eps eftersom större population ger fler "
        "distinkta kluster — annars äts alla av ett fåtal megakluster som "
        "sedan måste splittas på 40-gränsen.",
        s["GmBody"]))
    story.append(PageBreak())

    story.append(Image(dbscan_png, width=15 * cm, height=10 * cm))
    story.append(P(
        "Figur 3. Stockholm-användare projicerade till 2D via metric-MDS. "
        "Varje färg är en DBSCAN-grupp. Klustren ligger tydligt åtskilda — "
        "personornas struktur syns geometriskt.",
        s["GmCaption"]))

    story.append(P("3.3 Splitta kluster &gt; 40 medlemmar", s["GmH2"]))
    story.append(P(
        "DBSCAN bryr sig inte om gruppstorlek. Om Stockholm har 75 promenadare "
        "med liknande intressen hamnar de alla i samma kluster. Men UX-mål: "
        "ingen grupp över 40 medlemmar (kvalitet på interaktion sjunker). "
        "Lösning: rekursiv binär split — hitta de två mest <i>olika</i> "
        "medlemmarna, dela alla andra efter vilken de är närmast.",
        s["GmBody"]))

    story.append(P("3.4 Återplacera noise", s["GmH2"]))
    story.append(P(
        "Punkter som DBSCAN markerar som <i>noise</i> (för få grannar) "
        "kollas mot existerande klusters centroid. Om Jaccard ≥ 0.20 placeras "
        "de i närmaste kluster — annars stannar de i en separat \"fallback\"-grupp.",
        s["GmBody"]))

    story.append(P("3.5 Namnge kluster", s["GmH2"]))
    story.append(P(
        "Varje kluster får ett namn baserat på dess mest representativa "
        "intressen + stad. Generiska intressen filtreras bort först. "
        "Exempel: ett kluster med Schack, Bridge, Korsord + Fika blir "
        "<i>\"Spelgruppen Stockholm\"</i>, inte <i>\"Fika & Schack\"</i>.",
        s["GmBody"]))

    story.append(Image(sizes_png, width=15 * cm, height=7 * cm))
    story.append(P(
        "Figur 4. Distribution av medlemstal per grupp. Splittningen håller "
        "max-värdet vid 40; medianen ligger runt 15.",
        s["GmCaption"]))
    story.append(PageBreak())

    # ── 4. Runtime-tilldelning ──
    story.append(P("4. Runtime — tilldelning vid registrering", s["GmH1"]))
    story.append(P(
        "När en användare registrerar sig och anger intressen anropas "
        "<i>POST /api/communities/auto-assign</i>. Detta triggar "
        "<i>assignBestCommunity(userId)</i> i [server/ml.js](server/ml.js). "
        "Algoritmen i fyra steg:",
        s["GmBody"]))

    story.append(P("Steg 1 — filtrera kandidater", s["GmH2"]))
    story.append(P(
        "Hämta alla communities från databasen. Ta bort:", s["GmBody"]))
    story.append(P("• Grupper användaren redan är medlem i.", s["GmBullet"]))
    story.append(P("• Grupper användaren tidigare avvisat (sparat i <i>user_community_rejections</i>).", s["GmBullet"]))
    story.append(P("• Grupper med 40 medlemmar redan.", s["GmBullet"]))

    story.append(P("Steg 2 — poängsätt varje kandidat", s["GmH2"]))
    story.append(P(
        "För varje kvarstående grupp beräknas:", s["GmBody"]))
    story.append(P(
        "score = jaccard × 0.7 + cityScore × 0.3", s["GmCode"]))
    story.append(P(
        "Stadspoängen följer en stegfunktion:", s["GmBody"]))
    story.append(P("• Samma stad: <b>1.00</b>", s["GmBullet"]))
    story.append(P("• Annan stad &lt; 80 km bort: <b>0.80</b>", s["GmBullet"]))
    story.append(P("• 80–200 km: <b>0.55</b>", s["GmBullet"]))
    story.append(P("• Längre bort: <b>0.30</b>", s["GmBullet"]))
    story.append(P(
        "Stadsavstånd räknas med haversine-formeln på en intern tabell "
        "över de 24 största svenska städernas koordinater.",
        s["GmBody"]))

    story.append(Image(score_png, width=16 * cm, height=8.5 * cm))
    story.append(P(
        "Figur 5. Exempel: användare Maj i Stockholm med intressen "
        "{Schack, Bridge, Kortspel}. Spelgruppen Stockholm vinner (0.77) "
        "tack vare hög Jaccard (0.67) <i>och</i> samma stad. Yoga-gruppen "
        "i Stockholm hamnar lågt (0.37) eftersom intressena inte överlappar.",
        s["GmCaption"]))

    story.append(P("Steg 3 — välj högst, eller returnera null", s["GmH2"]))
    story.append(P(
        "Den högsta scoren vinner. Hård tröskel: om <i>bästa</i> är under "
        "0.05 returneras null istället för att tvinga in användaren i "
        "en irrelevant grupp. Det händer i praktiken bara om hen har 0 "
        "intressen — och den vägen stoppas redan på frontend.",
        s["GmBody"]))

    story.append(P("Steg 4 — atomär insert", s["GmH2"]))
    story.append(P(
        "Tilldelningen sker i en SQL-transaktion: kontroll-att-platsen-finns "
        "+ INSERT är atomära. Två samtidiga registreringar kan inte båda "
        "tippa över 40-gränsen.",
        s["GmBody"]))
    story.append(PageBreak())

    # ── 5. Kontinuerlig omvärdering ──
    story.append(P("5. Kontinuerlig omvärdering", s["GmH1"]))
    story.append(P(
        "Tilldelningen är inte ett engångsbeslut. Två mekanismer ser till "
        "att gruppen fortsätter passa över tid:",
        s["GmBody"]))

    story.append(P("Leave-and-reassign", s["GmH2"]))
    story.append(P(
        "Användaren kan när som helst lämna sin grupp. När det sker:",
        s["GmBody"]))
    story.append(P("1. Medlemskapet raderas.", s["GmBullet"]))
    story.append(P("2. Gruppen läggs till i <i>user_community_rejections</i> — den föreslås aldrig igen.", s["GmBullet"]))
    story.append(P("3. <i>assignBestCommunity</i> körs på nytt, med uppdaterad uteslutningslista.", s["GmBullet"]))
    story.append(P("4. Användaren omdirigeras direkt till nya gruppen.", s["GmBullet"]))

    story.append(P("Intresse-mismatch-banner", s["GmH2"]))
    story.append(P(
        "Om användaren ändrar intressen i profilen kan deras nuvarande "
        "grupp plötsligt passa sämre. Varje gång community-sidan laddas "
        "räknar servern om Jaccard mot aktuell grupp. Om scoren är "
        "under 0.15 visas en orange banner: <i>\"Dina intressen matchar inte "
        "längre gruppen så bra. Vill du hitta en grupp som passar bättre?\"</i> "
        "Knappen triggar samma leave-and-reassign-flöde.",
        s["GmBody"]))

    story.append(P("Stadsmismatch-banner", s["GmH2"]))
    story.append(P(
        "Om gruppen ligger i en annan stad än användarens (kan hända om "
        "alla närmare alternativ var fulla/avvisade) visas en informativ "
        "banner som förklarar varför — utan tvång att byta.",
        s["GmBody"]))
    story.append(PageBreak())

    # ── 6. Vad är inte ML här? ──
    story.append(P("6. Ärligt om vad detta är — och inte är", s["GmH1"]))
    story.append(P(
        "Termen \"ML\" används brett. Här är vad vårt system faktiskt gör "
        "— och inte gör:",
        s["GmBody"]))

    honesty_tbl = Table([
        ["✓ Detta är", "✗ Detta är inte"],
        ["Oövervakad inlärning via DBSCAN", "Övervakad inlärning (ingen label)"],
        ["Klusteranalys på Jaccard-distans", "Neuralt nätverk eller LLM"],
        ["Avstånds- + regelbaserad tilldelning", "Träning vid runtime"],
        ["Deterministisk per intresseprofil", "Anpassar sig löpande till feedback"],
        ["Förklarbart (visa varje delpoäng)", "Black-box-modell"],
    ], colWidths=[7.5 * cm, 7.5 * cm])
    honesty_tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10.5),
        ("BACKGROUND", (0, 0), (0, 0), HexColor("#E8F2EC")),
        ("BACKGROUND", (1, 0), (1, 0), HexColor("#FCEBD8")),
        ("TEXTCOLOR", (0, 0), (0, 0), HexColor(COLOR_PRIMARY)),
        ("TEXTCOLOR", (1, 0), (1, 0), HexColor(COLOR_ACCENT)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HexColor("#CCCCCC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(honesty_tbl)

    story.append(Spacer(1, 0.5 * cm))
    story.append(P(
        "Varför det här valet? Bostadens målgrupp är 60+. Tre saker väger "
        "tyngre än prediktiv prestanda:",
        s["GmBody"]))
    story.append(P(
        "<b>Förklarbarhet.</b> Vi kan visa varje delpoäng — \"du delar 3 av "
        "5 intressen och samma stad → 0.77\". Det bygger förtroende.",
        s["GmBullet"]))
    story.append(P(
        "<b>Determinism.</b> Två användare med samma profil hamnar i samma "
        "grupp. Mindre överraskning, mindre support.",
        s["GmBullet"]))
    story.append(P(
        "<b>Lågt drift-krav.</b> Ingen GPU. Ingen modell att underhålla. "
        "Hela tilldelningen är några SQL-queries + en O(N) loop.",
        s["GmBullet"]))

    story.append(P("Begränsningar — när detta skulle behöva uppgraderas", s["GmH2"]))
    story.append(P(
        "• <b>Antagandet att kluster är statiska.</b> När verkliga användare "
        "kommer in i systemet uppdateras inte klustren automatiskt — de "
        "frystes vid datasetgenereringen. Vid stor tillväxt skulle man "
        "behöva köra om DBSCAN periodiskt på riktiga användare.",
        s["GmBullet"]))
    story.append(P(
        "• <b>Ingen cold-start för helt nya intressetyper.</b> Om appen "
        "lägger till \"Padel\" som intresse finns inga grupper med Padel "
        "förrän klustringen körs om.",
        s["GmBullet"]))
    story.append(P(
        "• <b>Ingen kollaborativ filtrering.</b> Vi tittar bara på intressen, "
        "inte på vem som faktiskt pratar med vem. Det vore en naturlig "
        "v2-förbättring.",
        s["GmBullet"]))

    story.append(Spacer(1, 1 * cm))
    story.append(P(
        "<i>Slut.  För källkod, se [server/ml.js](server/ml.js) och "
        "[scripts/generate-synthetic-dataset.js]"
        "(scripts/generate-synthetic-dataset.js).</i>",
        s["GmBody"]))

    doc.build(story)
    print(f"PDF sparad: {OUT_PDF}")


if __name__ == "__main__":
    make_pdf()
