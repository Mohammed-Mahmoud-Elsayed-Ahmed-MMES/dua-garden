/**
 * pdf.js
 * Generates and downloads a beautifully formatted PDF of the
 * currently displayed (or favorited) duas using jsPDF.
 */

/* ── Arabic Text → Canvas Image ─────────────────────────────── */

/**
 * Render an Arabic string onto a canvas and return a PNG data URL.
 * This is required because jsPDF does not natively support RTL / Arabic shaping.
 *
 * @param {string} text
 * @param {number} maxWidthPx
 * @param {number} fontSize
 * @returns {Promise<{dataUrl:string, lineCount:number, lineH:number}>}
 */
function renderArabicToImage(text, maxWidthPx, fontSize) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const fontStr = `${fontSize}px Amiri, serif`;

    ctx.font = fontStr;

    // Word-wrap
    const words = text.split(' ');
    const lines  = [];
    let line     = '';

    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidthPx - 8 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);

    const lineH    = fontSize * 1.65;
    canvas.width   = maxWidthPx;
    canvas.height  = Math.ceil(lines.length * lineH) + 12;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font        = fontStr;
    ctx.fillStyle   = '#1A3A2A';
    ctx.textAlign   = 'right';
    ctx.direction   = 'rtl';

    lines.forEach((l, i) => ctx.fillText(l, maxWidthPx - 6, (i + 1) * lineH - 4));

    resolve({ dataUrl: canvas.toDataURL('image/png'), lineCount: lines.length, lineH });
  });
}

/* ── PDF Generation ──────────────────────────────────────────── */

async function downloadPDF() {
  const btn = document.getElementById('downloadPdfBtn');
  btn.disabled    = true;
  btn.textContent = 'Generating…';

  try {
    const { jsPDF }  = window.jspdf;
    const doc        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW      = 210, pageH = 297, margin = 16;
    const contentW   = pageW - margin * 2;
    const mmToPx     = 96 / 25.4;
    const contentWpx = Math.floor(contentW * mmToPx);
    const sectionTitle = document.getElementById('pageTitle').textContent;

    // ── Collect duas to export ──────────────────────────────
    let duasToExport = [];
    if (state.viewingFavorites) {
      if (state.favorites.size === 0) { showToast('No favorites to export', 'warning'); return; }
      const { data } = await db
        .from('duas')
        .select('*, categories(name,slug,icon)')
        .in('id', [...state.favorites])
        .eq('status', 'approved')
        .order('like_count', { ascending: false });
      duasToExport = data || [];
    } else {
      duasToExport = [...state.duas].sort((a, b) =>
        state.sortBy === 'likes'
          ? ((b.like_count || 0) - (a.like_count || 0)) || (new Date(b.created_at) - new Date(a.created_at))
          : new Date(b.created_at) - new Date(a.created_at)
      );
    }

    if (!duasToExport.length) { showToast('No duas to export', 'warning'); return; }

    // ── Pre-render all Arabic text to images ────────────────
    showToast('Rendering Arabic text…', 'info');
    const arabicImgs = {};
    await Promise.all(
      duasToExport.map(async dua => {
        if (dua.text_ar) arabicImgs[dua.id] = await renderArabicToImage(dua.text_ar, contentWpx, 26);
      })
    );

    // ── Cover page ──────────────────────────────────────────
    doc.setFillColor(26, 58, 42); doc.rect(0, 0, pageW, pageH, 'F');
    doc.setFillColor(200, 169, 110);
    doc.rect(0, 0, pageW, 5, 'F');
    doc.rect(0, pageH - 5, pageW, 5, 'F');

    doc.setFont('helvetica', 'bold');   doc.setFontSize(28); doc.setTextColor(232, 201, 138);
    doc.text('Dua Garden', pageW / 2, 100, { align: 'center' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(123, 170, 138);
    doc.text("hadiqa al-ad'iya", pageW / 2, 111, { align: 'center' });

    doc.setDrawColor(200, 169, 110); doc.setLineWidth(0.4);
    doc.line(margin + 25, 120, pageW - margin - 25, 120);

    doc.setFont('helvetica', 'bold');   doc.setFontSize(19); doc.setTextColor(250, 246, 238);
    doc.text(sectionTitle, pageW / 2, 134, { align: 'center' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(123, 170, 138);
    doc.text(`${duasToExport.length} Duas`, pageW / 2, 145, { align: 'center' });

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(9); doc.setTextColor(74, 114, 80);
    doc.text(`Generated on ${dateStr}`, pageW / 2, pageH - 18, { align: 'center' });

    // ── Content pages ───────────────────────────────────────
    let y = 0, pageNum = 1;

    function addPage() {
      doc.addPage(); pageNum++;
      doc.setFillColor(26, 58, 42); doc.rect(0, 0, pageW, 11, 'F');
      doc.setTextColor(200, 169, 110); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(`Dua Garden  |  ${sectionTitle}`, margin, 7);
      doc.setTextColor(123, 170, 138); doc.setFont('helvetica', 'normal');
      doc.text(`Page ${pageNum}`, pageW - margin, 7, { align: 'right' });
      y = 19;
    }

    function checkBreak(h) { if (y + h > pageH - 12) addPage(); }

    addPage();

    for (let idx = 0; idx < duasToExport.length; idx++) {
      const dua   = duasToExport[idx];
      const img   = arabicImgs[dua.id];
      const arabicH = img ? (img.lineCount * img.lineH / mmToPx) + 3 : 0;
      const totalH  =
        arabicH + 25 +
        (dua.transliteration ? Math.ceil(dua.transliteration.length / 90) * 5.5 : 0) +
        (dua.translation     ? Math.ceil(dua.translation.length     / 85) * 5   : 0) +
        (dua.source || dua.reference ? 7 : 0);

      checkBreak(totalH);

      // Number badge
      doc.setFillColor(26, 58, 42); doc.roundedRect(margin, y, 7, 5.5, 1.2, 1.2, 'F');
      doc.setTextColor(200, 169, 110); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text(String(idx + 1), margin + 3.5, y + 3.8, { align: 'center' });

      // Category label
      if (dua.categories) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(74, 122, 94);
        doc.text(`${dua.categories.icon || ''} ${dua.categories.name}`, margin + 10, y + 3.8);
      }

      // Like count
      if (dua.like_count > 0) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(224, 36, 94);
        doc.text(`♥ ${dua.like_count}`, pageW - margin, y + 3.8, { align: 'right' });
      }

      y += 8;
      doc.setDrawColor(235, 228, 215); doc.setLineWidth(0.25);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      // Arabic image
      if (img) {
        const imgH = img.lineCount * img.lineH / mmToPx;
        checkBreak(imgH + 3);
        doc.addImage(img.dataUrl, 'PNG', margin, y, contentW, imgH);
        y += imgH + 4;
      }

      // Transliteration
      if (dua.transliteration) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(80, 80, 80);
        doc.splitTextToSize(dua.transliteration, contentW).forEach(l => {
          checkBreak(5.5); doc.text(l, margin, y); y += 5.2;
        });
        y += 2;
      }

      // Translation
      if (dua.translation) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(28, 28, 28);
        doc.splitTextToSize(dua.translation, contentW).forEach(l => {
          checkBreak(5); doc.text(l, margin, y); y += 5;
        });
        y += 2;
      }

      // Source / reference
      if (dua.source || dua.reference) {
        checkBreak(6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
        doc.text(`Source: ${[dua.source, dua.reference].filter(Boolean).join('  |  ')}`, margin, y);
        y += 5;
      }

      // Separator
      y += 3;
      doc.setDrawColor(235, 228, 215); doc.setLineWidth(0.2);
      doc.line(margin, y, pageW - margin, y);
      y += 9;
    }

    const filename = `DuaGarden_${sectionTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    showToast(`PDF downloaded! (${duasToExport.length} duas)`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Could not generate PDF: ' + err.message, 'error');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PDF`;
  }
}