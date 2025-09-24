import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { readSitesFile } from './getUrlsFromFile.js';
import { SitesUrls } from './sites.js';

dotenv.config()

const API_KEY = 'AIzaSyDBVrOg-IOYZu_p0CuXZhv1sCVIE9UrKAs'
const strategies = ['mobile', 'desktop'];
const categories = ['accessibility', 'best-practices', 'performance', 'seo'];

//* Create urls for lighthouse based on current values
// return an arrat of objects with mobile and desktop urls
const createFetchUrls = urls => {
  const resultUrls = [];

  for (const url of urls) {
    const urlObj = {
      mobile: '',
      desktop: '',
      original: url.url,
      route: url.ruta,
      screen: url.pantalla
    };

    for (const strategy of strategies) {
      const u = new URL('https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed');
      u.searchParams.set('key', API_KEY);
      u.searchParams.set('url', url.url);
      u.searchParams.set('strategy', strategy);
      categories.forEach(category => u.searchParams.append('category', category));

      if (strategy === 'mobile') urlObj.mobile = u.toString();   // <-- string
      if (strategy === 'desktop') urlObj.desktop = u.toString(); // <-- string
    }

    resultUrls.push(urlObj);
  }

  return resultUrls;
};

//* Simple fetch to call API
// * return the json result or null if error
const getData = async evaluationUrl => {
  try {
    const response = await fetch(evaluationUrl);
    if (!response.ok) {
      const errText = await response.text();
      console.error('Error body:', errText); // aquí verás el motivo (originNotAllowed, keyInvalid, quotaExceeded, etc.)
      throw new Error(`Response status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching data: ${error.message}`);
    return null;
  }
};

//* Object for easy access to fields
const extractFields = reportData => {
  return {
    initialUrl: reportData.loadingExperience.initial_url,
    finalUrl: reportData.lighthouseResult.finalUrl,
    emulatedDevice:
      reportData.lighthouseResult.configSettings.emulatedFormFactor,
    performanceScore: reportData.lighthouseResult.categories.performance.score,
    accessibilityScore:
      reportData.lighthouseResult.categories.accessibility.score,
    bestPracticesScore:
      reportData.lighthouseResult.categories['best-practices'].score,
    seoScore: reportData.lighthouseResult.categories.seo.score
  }
}

//* Object for Json result
const createReportObject = (
  originalUrl,
  route,
  screen,
  mobileData,
  desktopData
) => {
  const mobileObjData = mobileData ? extractFields(mobileData) : {}
  const desktopObjData = desktopData ? extractFields(desktopData) : {}

  return {
    route: route,
    screen: screen,
    url: originalUrl,
    mobile_performance: mobileObjData.performanceScore || '',
    mobile_accessibility: mobileObjData.accessibilityScore || '',
    mobile_best_practices: mobileObjData.bestPracticesScore || '',
    mobile_seo: mobileObjData.seoScore || '',
    desktop_performance: desktopObjData.performanceScore || '',
    desktop_accessibility: desktopObjData.accessibilityScore || '',
    desktop_best_practices: desktopObjData.bestPracticesScore || '',
    desktop_seo: desktopObjData.seoScore || ''
  }
}

async function run () {
  let nonResult = []
  let reportsArray = []

  //* Both works, from file or from sites.txt 
  let urls = SitesUrls
  const fileUrls = await readSitesFile('sites.txt', false)

  // arreglo de objetos con las urls para evaluar mobile y desktop
  const urlArray = createFetchUrls(fileUrls)

  let iteration = 1
  for (const urlObj of urlArray) {
    console.clear()
    console.log(`Realizando el reporte ${iteration} de ${urlArray.length}`)

    // Fetch data result might be JSON or null
    const mobileResult = await getData(urlObj.mobile)
    const desktopResult = await getData(urlObj.desktop)

    if (!mobileResult) {
      const evaluatedUrl = {
        url: urlObj.original,
        device: 'MOBILE'
      }
      nonResult.push(evaluatedUrl)
    }

    if (!desktopResult) {
      const evaluatedUrl = {
        url: urlObj.original,
        device: 'DESKTOP'
      }
      nonResult.push(evaluatedUrl)
    }

    const reportResult = createReportObject(
      urlObj.original,
      urlObj.route,
      urlObj.screen,
      mobileResult,
      desktopResult
    )

    reportsArray.push(reportResult)
    iteration++
  }

  const finalResult = {
    nonResult: nonResult,
    reports: reportsArray
  }

  console.log(JSON.stringify(finalResult, null, 2))









// === Helper de color para métricas (0–1 o 0–100) ===
function fillFor(value) {
  // ARGB (ExcelJS usa ARGB)
  const COLORS = {
    NO_DATA: 'FFDDDDDD', // gris
    RED:     'FFF8D7DA', // < 50%
    YELLOW:  'FFFFF3CD', // 50–89%
    GREEN:   'FFD1E7DD', // ≥ 90%
  };

  if (value === '' || value == null) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NO_DATA } };
  }

  let n = Number(value);
  if (Number.isNaN(n)) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NO_DATA } };
  }

  // Normaliza si viene 0–100
  if (n > 1) n = n / 100;

  if (n < 0.5) return { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED } };
  if (n < 0.9) return { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.YELLOW } };
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GREEN } };
}

/**
 * Crea el Excel con el formato solicitado (adaptado a tu shape actual)
 * @param {Array<{
 *   route:string, screen:string, url:string,
 *   mobile_performance:number|string|'',
 *   mobile_accessibility:number|string|'',
 *   mobile_best_practices:number|string|'',
 *   mobile_seo:number|string|'',
 *   desktop_performance:number|string|'',
 *   desktop_accessibility:number|string|'',
 *   desktop_best_practices:number|string|'',
 *   desktop_seo:number|string|''
 * }>} reports
 * @param {string} outputPath
 */
async function exportToExcel(reports, outputPath = 'lighthouse.xlsx') {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Reporte');

  // Encabezados (2 filas)
  const row1 = [
    'Ruta Roja - Ruta Crítica', // A (route)
    'Pantallas involucradas',   // B (screen)
    'URL evaluada',             // C (url)
    'Reporte PageSpeed o Lighthouse', // D (vacío)
    'Mobile', '', '', '',       // E-H
    'Desktop', '', '', '',      // I-L
    'Notas / Principales por problemas' // M
  ];
  const row2 = [
    '', '', '', '',
    'Rendimiento', 'Accesibilidad', 'Buenas prácticas', 'SEO',
    'Rendimiento', 'Accesibilidad', 'Buenas prácticas', 'SEO',
    ''
  ];
  ws.addRow(row1);
  ws.addRow(row2);

  // Merge encabezados
  ws.mergeCells('A1:A2');
  ws.mergeCells('B1:B2');
  ws.mergeCells('C1:C2');
  ws.mergeCells('D1:D2');
  ws.mergeCells('E1:H1'); // Mobile
  ws.mergeCells('I1:L1'); // Desktop
  ws.mergeCells('M1:M2');

  // Estilos encabezados
  for (let col = 1; col <= 13; col++) {
    const c1 = ws.getCell(1, col);
    const c2 = ws.getCell(2, col);
    c1.font = c2.font = { bold: true };
    c1.alignment = c2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c1.border = c2.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
  }

  // Anchos
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 45;
  ws.getColumn(4).width = 28;
  for (let c = 5; c <= 12; c++) ws.getColumn(c).width = 16;
  ws.getColumn(13).width = 36;

  // Congelar encabezados
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

  // Agrupa por route (preserva orden)
  const safeReports = Array.isArray(reports) ? reports : [];
  const groups = new Map();
  for (const r of safeReports) {
    const key = r.route ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  // Insertar filas
  let currentRow = 3;
  for (const [route, items] of groups) {
    const startRow = currentRow;

    for (const r of items) {
      const row = ws.addRow([
        route || '',               // A
        r.screen ?? '',            // B
        r.url ?? '',               // C
        '',                        // D
        r.mobile_performance ?? '',       // E
        r.mobile_accessibility ?? '',     // F
        r.mobile_best_practices ?? '',    // G
        r.mobile_seo ?? '',               // H
        r.desktop_performance ?? '',      // I
        r.desktop_accessibility ?? '',    // J
        r.desktop_best_practices ?? '',   // K
        r.desktop_seo ?? '',              // L
        ''                         // M
      ]);

      // Convierte C en hyperlink si hay URL
      const c3 = ws.getCell(row.number, 3);
      const urlText = String(r.url ?? '').trim();
      if (urlText) {
        c3.value = { text: urlText, hyperlink: urlText };
        c3.font = { color: { argb: 'FF0563C1' }, underline: true };
      }

      // Bordes, alineaciones y formato de métricas
      row.eachCell((cell, colNumber) => {
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

        if (colNumber >= 5 && colNumber <= 12) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };

          // Normaliza a 0–1 para mostrar %
          let raw = cell.value;
          let num = (typeof raw === 'number') ? raw : (raw === '' || raw == null ? NaN : Number(raw));
          if (!Number.isNaN(num)) {
            if (num > 1) num = num / 100; // si viene 0–100
            cell.value = num;             // asegura 0–1
            cell.numFmt = '0%';
            cell.fill = fillFor(num);
          } else {
            cell.fill = fillFor('');
          }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 3 ? 'left' : 'center', wrapText: true };
        }
      });

      currentRow++;
    }

    // Merge columna A si hay varias filas en el mismo route
    if (route && items.length > 1) {
      ws.mergeCells(`A${startRow}:A${currentRow - 1}`);
      ws.getCell(`A${startRow}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Archivo creado: ${outputPath}`);
}

await exportToExcel(finalResult.reports, 'lighthouse.xlsx');


}

run()

