"""
Bygger en Jupyter-notebook (docs/ml-forklaring.ipynb) med körbara
Python-celler som speglar JS-implementationen i server/ml.js.
"""

import os
import json
import nbformat as nbf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "ml-forklaring.ipynb")


def md(text):
    return nbf.v4.new_markdown_cell(text)


def code(text):
    return nbf.v4.new_code_cell(text)


nb = nbf.v4.new_notebook()

cells = []

cells.append(md(
    "# Hur ML fungerar i Gemenskap — körbar version\n"
    "\n"
    "Den här notebooken visar Gemenskaps ML-pipeline med körbar Python.\n"
    "Den speglar JavaScript-implementationen i `server/ml.js` och\n"
    "`scripts/generate-synthetic-dataset.js` så du kan experimentera\n"
    "med parametrar och se direkt hur tilldelningen ändras.\n"
    "\n"
    "**Innehåll:**\n"
    "1. Ladda datasetet (1500 användare, 88 communities)\n"
    "2. Viktad Jaccard — implementation + demo\n"
    "3. DBSCAN i miniatyr — kör om på Stockholm-datan\n"
    "4. Runtime: `assignBestCommunity()` steg för steg\n"
    "5. Vad händer när användaren byter intressen?\n"
    "6. Visualiseringar\n"
    "\n"
    "**Krav:** `pip install numpy matplotlib`"
))

cells.append(md(
    "## 1. Ladda datasetet\n"
    "\n"
    "Datasetet skapades av `scripts/generate-synthetic-dataset.js` och\n"
    "är en JSON-fil med tre listor: `users`, `communities`, `memberships`."
))

cells.append(code(
    "import json\n"
    "import os\n"
    "import numpy as np\n"
    "import matplotlib.pyplot as plt\n"
    "from collections import Counter, defaultdict\n"
    "\n"
    "# Hitta dataset.json — fungerar från docs/ eller projektroten\n"
    "candidates = [\n"
    "    '../data/dataset.json',\n"
    "    'data/dataset.json',\n"
    "]\n"
    "dataset_path = next(p for p in candidates if os.path.exists(p))\n"
    "with open(dataset_path, encoding='utf-8') as f:\n"
    "    ds = json.load(f)\n"
    "\n"
    "users = ds['users']\n"
    "communities = ds['communities']\n"
    "memberships = ds['memberships']\n"
    "\n"
    "print(f'{len(users)} användare')\n"
    "print(f'{len(communities)} communities')\n"
    "print(f'{len(memberships)} medlemskap')\n"
    "\n"
    "# Exempel: titta på en användare\n"
    "u = users[0]\n"
    "print(f\"\\nExempel-användare: {u['display_name']} i {u['city']}\")\n"
    "print(f\"Intressen: {u['interests']}\")"
))

cells.append(md(
    "## 2. Viktad Jaccard\n"
    "\n"
    "Jaccard-index mäter likheten mellan två mängder som\n"
    "$J(A, B) = \\dfrac{|A \\cap B|}{|A \\cup B|}$.\n"
    "\n"
    "Vi använder en **viktad** variant: tre \"generiska\" intressen\n"
    "(*Promenader*, *Fika*, *Resor*) får halverad vikt eftersom nästan\n"
    "alla seniorer har minst ett av dem — de borde inte ensamma\n"
    "styra tilldelningen.\n"
    "\n"
    "Implementationen nedan är en exakt translation av `weightedJaccard()`\n"
    "från `server/ml.js`."
))

cells.append(code(
    "GENERIC_INTERESTS = {'Promenader', 'Fika', 'Resor'}\n"
    "\n"
    "def weighted_jaccard(user_interests, community_interests):\n"
    "    u = set(user_interests)\n"
    "    c = set(community_interests)\n"
    "    if not u or not c:\n"
    "        return 0.0\n"
    "    inter_w = 0.0\n"
    "    union_w = 0.0\n"
    "    seen = set()\n"
    "    for it in u:\n"
    "        w = 0.5 if it in GENERIC_INTERESTS else 1.0\n"
    "        if it in c:\n"
    "            inter_w += w\n"
    "        union_w += w\n"
    "        seen.add(it)\n"
    "    for it in c:\n"
    "        if it in seen:\n"
    "            continue\n"
    "        union_w += 0.5 if it in GENERIC_INTERESTS else 1.0\n"
    "    return inter_w / union_w if union_w else 0.0\n"
    "\n"
    "# Demo\n"
    "user = ['Schack', 'Bridge', 'Fika']\n"
    "comm = ['Schack', 'Kortspel', 'Korsord', 'Fika']\n"
    "print(f'Användare: {user}')\n"
    "print(f'Grupp:     {comm}')\n"
    "print(f'Viktad Jaccard: {weighted_jaccard(user, comm):.3f}')\n"
    "\n"
    "# Jämför med oviktad\n"
    "def plain_jaccard(a, b):\n"
    "    a, b = set(a), set(b)\n"
    "    return len(a & b) / len(a | b) if (a | b) else 0\n"
    "\n"
    "print(f'Oviktad Jaccard: {plain_jaccard(user, comm):.3f}')"
))

cells.append(md(
    "### Effekten av viktningen\n"
    "\n"
    "Här syns varför viktningen spelar roll. Två användare som bara\n"
    "delar `Fika` med en grupp får en lägre poäng än två som delar\n"
    "ett \"riktigt\" intresse — även om antalet gemensamma intressen\n"
    "är samma."
))

cells.append(code(
    "scenarios = [\n"
    "    ('Delar bara Fika',     ['Fika'],            ['Schack', 'Bridge', 'Fika']),\n"
    "    ('Delar bara Schack',   ['Schack'],          ['Schack', 'Bridge', 'Kortspel']),\n"
    "    ('Delar Fika + Schack', ['Fika', 'Schack'],  ['Schack', 'Bridge', 'Fika']),\n"
    "    ('Alla generiska',      ['Promenader', 'Fika', 'Resor'], ['Promenader', 'Fika', 'Resor']),\n"
    "]\n"
    "for label, u, c in scenarios:\n"
    "    print(f\"{label:30s} viktad={weighted_jaccard(u, c):.3f}  oviktad={plain_jaccard(u, c):.3f}\")"
))

cells.append(md(
    "## 3. DBSCAN i miniatyr\n"
    "\n"
    "Här är en Python-version av DBSCAN-implementationen från\n"
    "`scripts/generate-synthetic-dataset.js`. Vi kör den på alla\n"
    "Stockholm-användare och jämför med den faktiska klustringen\n"
    "som producerade datasetet."
))

cells.append(code(
    "def jaccard_distance(a, b):\n"
    "    a, b = set(a), set(b)\n"
    "    if not a and not b:\n"
    "        return 0.0\n"
    "    inter = len(a & b)\n"
    "    union = len(a | b)\n"
    "    return 1 - (inter / union if union else 1.0)\n"
    "\n"
    "def dbscan(points, eps, min_samples):\n"
    "    \"\"\"Klassisk DBSCAN: punkt = lista av intressen, distans = 1 - Jaccard.\"\"\"\n"
    "    n = len(points)\n"
    "    labels = [None] * n  # None=ej besökt, -1=noise, >=0=kluster\n"
    "    cluster_id = -1\n"
    "    \n"
    "    def neighbors(i):\n"
    "        return [j for j in range(n) if j != i\n"
    "                and jaccard_distance(points[i], points[j]) <= eps]\n"
    "    \n"
    "    for i in range(n):\n"
    "        if labels[i] is not None:\n"
    "            continue\n"
    "        N = neighbors(i)\n"
    "        if len(N) < min_samples:\n"
    "            labels[i] = -1\n"
    "            continue\n"
    "        cluster_id += 1\n"
    "        labels[i] = cluster_id\n"
    "        queue = list(N)\n"
    "        in_queue = set(queue)\n"
    "        while queue:\n"
    "            j = queue.pop(0)\n"
    "            if labels[j] == -1:\n"
    "                labels[j] = cluster_id  # border-punkt\n"
    "            if labels[j] is not None:\n"
    "                continue\n"
    "            labels[j] = cluster_id\n"
    "            Nj = neighbors(j)\n"
    "            if len(Nj) >= min_samples:\n"
    "                for k in Nj:\n"
    "                    if k not in in_queue:\n"
    "                        queue.append(k); in_queue.add(k)\n"
    "    return labels\n"
    "\n"
    "# Kör DBSCAN på Stockholm-användarna (delmängd för fart)\n"
    "sthlm = [u for u in users if u['city'] == 'Stockholm'][:120]\n"
    "points = [u['interests'] for u in sthlm]\n"
    "\n"
    "labels = dbscan(points, eps=0.38, min_samples=3)\n"
    "n_clusters = len({l for l in labels if l >= 0})\n"
    "n_noise = sum(1 for l in labels if l == -1)\n"
    "print(f'DBSCAN-resultat på {len(sthlm)} Stockholm-användare:')\n"
    "print(f'  eps=0.38, minSamples=3')\n"
    "print(f'  {n_clusters} kluster, {n_noise} noise-punkter ({100*n_noise/len(sthlm):.0f}%)')"
))

cells.append(md(
    "### Experimentera med eps\n"
    "\n"
    "Prova själv: vad händer om eps är för snäv eller för lös?"
))

cells.append(code(
    "print('eps | clusters | noise')\n"
    "print('-' * 30)\n"
    "for eps in [0.25, 0.32, 0.38, 0.45, 0.55, 0.65]:\n"
    "    labels = dbscan(points, eps=eps, min_samples=3)\n"
    "    n_clusters = len({l for l in labels if l >= 0})\n"
    "    n_noise = sum(1 for l in labels if l == -1)\n"
    "    bar = '█' * n_clusters\n"
    "    print(f'{eps:.2f}|  {n_clusters:3d}     | {n_noise:3d}  {bar}')"
))

cells.append(md(
    "## 4. Runtime — `assignBestCommunity()` steg för steg\n"
    "\n"
    "När en användare registrerar sig och anger intressen körs:\n"
    "\n"
    "```\n"
    "score = jaccard × 0.7 + cityScore × 0.3\n"
    "```\n"
    "\n"
    "Cityscore följer en stegfunktion:\n"
    "\n"
    "| Avstånd                    | Score |\n"
    "|----------------------------|-------|\n"
    "| Samma stad                 | 1.00  |\n"
    "| < 80 km                    | 0.80  |\n"
    "| 80–200 km                  | 0.55  |\n"
    "| Längre bort                | 0.30  |\n"
    "\n"
    "Här replikerar vi det i Python."
))

cells.append(code(
    "import math\n"
    "\n"
    "CITY_COORDS = {\n"
    "    'stockholm':   (59.3293, 18.0686),\n"
    "    'göteborg':    (57.7089, 11.9746),\n"
    "    'malmö':       (55.6050, 13.0038),\n"
    "    'uppsala':     (59.8586, 17.6389),\n"
    "    'västerås':    (59.6099, 16.5448),\n"
    "    'örebro':      (59.2753, 15.2134),\n"
    "    'linköping':   (58.4108, 15.6214),\n"
    "    'helsingborg': (56.0465, 12.6945),\n"
    "    'norrköping':  (58.5877, 16.1924),\n"
    "}\n"
    "\n"
    "def haversine_km(lat1, lon1, lat2, lon2):\n"
    "    R = 6371\n"
    "    dlat = math.radians(lat2 - lat1)\n"
    "    dlon = math.radians(lon2 - lon1)\n"
    "    a = (math.sin(dlat/2)**2\n"
    "         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))\n"
    "         * math.sin(dlon/2)**2)\n"
    "    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))\n"
    "\n"
    "def city_score(user_city, community_city):\n"
    "    if not user_city or not community_city:\n"
    "        return 0.5\n"
    "    if user_city.lower() == community_city.lower():\n"
    "        return 1.0\n"
    "    a = CITY_COORDS.get(user_city.lower())\n"
    "    b = CITY_COORDS.get(community_city.lower())\n"
    "    if not a or not b:\n"
    "        return 0.30\n"
    "    km = haversine_km(*a, *b)\n"
    "    if km < 80:  return 0.80\n"
    "    if km < 200: return 0.55\n"
    "    return 0.30\n"
    "\n"
    "def assign_best_community(user_interests, user_city, communities,\n"
    "                          exclude_ids=None, threshold=0.05):\n"
    "    exclude_ids = exclude_ids or set()\n"
    "    candidates = [c for c in communities if c['id'] not in exclude_ids]\n"
    "    best = None\n"
    "    best_score = -1\n"
    "    for c in candidates:\n"
    "        jacc = weighted_jaccard(user_interests, c['interests'])\n"
    "        cs = city_score(user_city, c['city'])\n"
    "        score = jacc * 0.7 + cs * 0.3\n"
    "        if score > best_score:\n"
    "            best_score = score\n"
    "            best = {'community': c, 'jaccard': jacc, 'cityScore': cs, 'score': score}\n"
    "    if best is None or best_score < threshold:\n"
    "        return None\n"
    "    return best"
))

cells.append(md(
    "### Konkret exempel: Maj i Stockholm\n"
    "\n"
    "Maj är 70 år och har intressen `{Schack, Bridge, Kortspel}`. Vi\n"
    "kör tilldelningen och tittar på topp-5 kandidater."
))

cells.append(code(
    "maj_interests = ['Schack', 'Bridge', 'Kortspel']\n"
    "maj_city = 'Stockholm'\n"
    "\n"
    "# Räkna score för varje grupp\n"
    "scored = []\n"
    "for c in communities:\n"
    "    j = weighted_jaccard(maj_interests, c['interests'])\n"
    "    cs = city_score(maj_city, c['city'])\n"
    "    score = j * 0.7 + cs * 0.3\n"
    "    scored.append({\n"
    "        'name': c['name'],\n"
    "        'city': c['city'],\n"
    "        'interests': c['interests'],\n"
    "        'jaccard': j,\n"
    "        'cityScore': cs,\n"
    "        'score': score,\n"
    "    })\n"
    "scored.sort(key=lambda x: -x['score'])\n"
    "\n"
    "print(f\"Topp-5 grupper för Maj (intressen: {maj_interests}, stad: {maj_city}):\\n\")\n"
    "print(f\"{'Grupp':35s} {'Stad':14s} {'Jacc':>6s} {'CityS':>6s} {'Tot':>6s}\")\n"
    "print('-' * 75)\n"
    "for s in scored[:5]:\n"
    "    print(f\"{s['name'][:34]:35s} {s['city'][:13]:14s}\"\n"
    "          f\" {s['jaccard']:6.2f} {s['cityScore']:6.2f} {s['score']:6.2f}\")\n"
    "print()\n"
    "print(f\"Tilldelad: {scored[0]['name']}  (score={scored[0]['score']:.2f})\")\n"
    "print(f\"Delade intressen: {set(maj_interests) & set(scored[0]['interests'])}\")"
))

cells.append(md(
    "## 5. Vad händer när användaren ändrar intressen?\n"
    "\n"
    "Maj är nu med i en spelgrupp. Vad händer om hon byter intresseprofil\n"
    "till `{Yoga, Pilates, Meditation}`? Vi räknar Jaccard mot hennes\n"
    "nuvarande grupp och utlöser mismatch-bannern om den är under 0.15."
))

cells.append(code(
    "MISMATCH_THRESHOLD = 0.15\n"
    "\n"
    "current_group = scored[0]  # Spelgruppen från förra cellen\n"
    "new_interests = ['Yoga', 'Pilates', 'Meditation']\n"
    "\n"
    "new_jaccard = weighted_jaccard(new_interests, current_group['interests'])\n"
    "print(f'Nuvarande grupp: {current_group[\"name\"]}')\n"
    "print(f'Gruppens intressen: {current_group[\"interests\"]}')\n"
    "print(f'Majs nya intressen: {new_interests}')\n"
    "print(f'\\nViktad Jaccard nu: {new_jaccard:.3f}')\n"
    "print(f'Tröskel: {MISMATCH_THRESHOLD}')\n"
    "if new_jaccard < MISMATCH_THRESHOLD:\n"
    "    print(f'\\n⚠  Banner visas: \"Dina intressen matchar inte längre gruppen\"')\n"
    "else:\n"
    "    print(f'\\n✓  Ingen banner — match är ok')\n"
    "\n"
    "# Om Maj klickar \"Hitta ny grupp\":\n"
    "rejected = {current_group['name']}\n"
    "rejected_ids = {c['id'] for c in communities if c['name'] in rejected}\n"
    "new_assignment = assign_best_community(new_interests, 'Stockholm',\n"
    "                                       communities, exclude_ids=rejected_ids)\n"
    "print(f'\\nNy tilldelning: {new_assignment[\"community\"][\"name\"]}'\n"
    "      f'  (score={new_assignment[\"score\"]:.2f})')"
))

cells.append(md(
    "## 6. Visualiseringar\n"
    "\n"
    "### 6.1 Klusterstorlekar"
))

cells.append(code(
    "sizes = Counter(m['communityId'] for m in memberships)\n"
    "counts = list(sizes.values())\n"
    "\n"
    "plt.figure(figsize=(10, 4))\n"
    "plt.hist(counts, bins=range(0, 45, 2), color='#2E7D5E',\n"
    "         edgecolor='white', alpha=0.85)\n"
    "plt.axvline(40, color='#E67E22', linestyle='--', linewidth=2,\n"
    "            label='MAX_MEMBERS = 40')\n"
    "plt.xlabel('Antal medlemmar per grupp')\n"
    "plt.ylabel('Antal grupper')\n"
    "plt.title(f'Distribution av klusterstorlekar ({len(counts)} grupper)')\n"
    "plt.legend()\n"
    "plt.grid(axis='y', alpha=0.25)\n"
    "plt.tight_layout()\n"
    "plt.show()\n"
    "\n"
    "print(f'min={min(counts)}, median={sorted(counts)[len(counts)//2]}, max={max(counts)}')"
))

cells.append(md(
    "### 6.2 Intressefrekvens"
))

cells.append(code(
    "interest_count = Counter()\n"
    "for u in users:\n"
    "    for it in u['interests']:\n"
    "        interest_count[it] += 1\n"
    "\n"
    "top = interest_count.most_common(20)\n"
    "names = [t[0] for t in top]\n"
    "vals = [t[1] for t in top]\n"
    "colors = ['#E67E22' if n in GENERIC_INTERESTS else '#2E7D5E' for n in names]\n"
    "\n"
    "plt.figure(figsize=(10, 6))\n"
    "plt.barh(range(len(names)), vals, color=colors)\n"
    "plt.yticks(range(len(names)), names)\n"
    "plt.gca().invert_yaxis()\n"
    "plt.xlabel('Antal användare')\n"
    "plt.title('Topp 20 intressen — generiska (orange) viktas ned')\n"
    "plt.grid(axis='x', alpha=0.25)\n"
    "plt.tight_layout()\n"
    "plt.show()"
))

cells.append(md(
    "### 6.3 Score-uppdelning för Majs kandidater"
))

cells.append(code(
    "top5 = scored[:5]\n"
    "names = [c['name'][:20] for c in top5]\n"
    "jacc_part = [c['jaccard'] * 0.7 for c in top5]\n"
    "city_part = [c['cityScore'] * 0.3 for c in top5]\n"
    "\n"
    "plt.figure(figsize=(10, 5))\n"
    "x = np.arange(len(names))\n"
    "plt.bar(x, jacc_part, color='#2E7D5E', label='Jaccard × 0.7')\n"
    "plt.bar(x, city_part, bottom=jacc_part, color='#E67E22', label='Stad × 0.3')\n"
    "for i, c in enumerate(top5):\n"
    "    plt.text(i, c['score'] + 0.02, f\"{c['score']:.2f}\",\n"
    "             ha='center', fontweight='bold')\n"
    "plt.xticks(x, names, rotation=20, ha='right')\n"
    "plt.ylabel('Slutpoäng')\n"
    "plt.ylim(0, 1.05)\n"
    "plt.title('Score-uppdelning för Majs topp-5 kandidater')\n"
    "plt.legend()\n"
    "plt.grid(axis='y', alpha=0.25)\n"
    "plt.tight_layout()\n"
    "plt.show()"
))

cells.append(md(
    "## Sammanfattning\n"
    "\n"
    "Vad vi har visat:\n"
    "\n"
    "1. **Viktad Jaccard** är hjärtat i likhetsmåttet. Generiska intressen\n"
    "   vägs ned så de inte ensamma styr tilldelningen.\n"
    "2. **DBSCAN per stad** bildar koherenta grupper offline. Parametrar\n"
    "   per stad (eps, minSamples) är inställda för att producera 5–15\n"
    "   grupper i varje stad.\n"
    "3. **Runtime-tilldelningen** är en enkel formel:\n"
    "   `score = jaccard × 0.7 + cityScore × 0.3`. Inget neuralt nätverk,\n"
    "   ingen träning, ingen LLM.\n"
    "4. **Kontinuerlig omvärdering** sker via Jaccard mot nuvarande grupp\n"
    "   varje gång community-sidan laddas — om scoren faller under 0.15\n"
    "   visas en banner som föreslår byte.\n"
    "\n"
    "**Designval:** förklarbarhet och determinism före prediktiv prestanda.\n"
    "Användarna är seniorer; varje delpoäng måste kunna förklaras med en mening.\n"
    "\n"
    "Källkod: [`server/ml.js`](../server/ml.js) och\n"
    "[`scripts/generate-synthetic-dataset.js`](../scripts/generate-synthetic-dataset.js)."
))


nb["cells"] = cells
nb["metadata"] = {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "version": "3.11"},
}

with open(OUT, "w", encoding="utf-8") as f:
    nbf.write(nb, f)

print(f"Notebook sparad: {OUT}")
print(f"Antal celler: {len(cells)}")
