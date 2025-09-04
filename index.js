import { writeFileSync } from 'fs';  // For file writing
import { parse } from 'json2csv';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = "AIzaSyBCJs3zOZXXDdSCMVEkuJPEOMXr1zsHQgY";
const strategies = ['MOBILE', 'DESKTOP'];
const categories = ['ACCESSIBILITY', 'BEST_PRACTICES', 'PERFORMANCE', 'SEO'];

let urls = [
    'https://www.riotgames.com/en/',
    'https://hollowknightsilksong.com/',
];

//* Create urls for lighthouse based on current values
const createFetchUrls = () => {
    let resultUrls = [];

    for (const strategy of strategies) {
        for (const url of urls) {
            const u = new URL('https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed');
            u.searchParams.set('key', API_KEY);
            u.searchParams.set('url', url);
            u.searchParams.set('strategy', strategy);
            categories.forEach(category => {
                u.searchParams.append('category', category);
            });

            resultUrls.push(u);
        }
    }

    return resultUrls;
};

//* Simple fetch to call API
const getData = async (evaluationUrl) => {
    try {
        const response = await fetch(evaluationUrl);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`Error fetching data: ${error.message}`);
        return null;
    }
}

//* Object property for csv fields
const extractFields = (reportData) => {
    return {
        initialUrl: reportData.loadingExperience.initial_url,
        finalUrl: reportData.lighthouseResult.finalUrl,
        emulatedDevice: reportData.lighthouseResult.configSettings.emulatedFormFactor,
        performanceScore: reportData.lighthouseResult.categories.performance.score,
        accessibilityScore: reportData.lighthouseResult.categories.accessibility.score,
        bestPracticesScore: reportData.lighthouseResult.categories['best-practices'].score,
        seoScore: reportData.lighthouseResult.categories.seo.score,
    };
};

const generateFileName = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 0-11 → 1-12
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}-${hours}-${minutes}`;
}

async function run() {
    let nonResult = [];
    let successfulResults = [];

    const urls = createFetchUrls();

    let iteration = 1;
    for (const url of urls) {
        console.clear();
        console.log(`Realizando el reporte ${iteration} de ${urls.length}`);
        const reportData = await getData(url);

        if (!reportData) {
            const evaluatedUrl = url.searchParams.get('url');
            if (!nonResult.includes(evaluatedUrl)) {
                nonResult.push(evaluatedUrl);
            }
            iteration++;
            continue;
        }

        const extractedData = extractFields(reportData);
        successfulResults.push(extractedData);
        iteration++;
    }

    if (nonResult.length > 0) {
        console.log("URLs with no results:");
        nonResult.forEach(url => console.log(url.toString()))
    }

    if (successfulResults.length > 0) {
        const csv = parse(successfulResults);
        const filename = generateFileName()
        const filePath = './lighthouse_reports.csv';

        writeFileSync(filePath, csv);
        console.log(`CSV file saved to ${filePath}`);
    } else {
        console.log('No successful results to write to CSV.');
    }

}

run()
