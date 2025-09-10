import { writeFileSync } from 'fs' // For file writing
import { parse } from 'json2csv'
import dotenv from 'dotenv'
import { url } from 'inspector'

dotenv.config()

const API_KEY = 'AIzaSyBCJs3zOZXXDdSCMVEkuJPEOMXr1zsHQgY'
const strategies = ['MOBILE', 'DESKTOP']
const categories = ['ACCESSIBILITY', 'BEST_PRACTICES', 'PERFORMANCE', 'SEO']

let urls = [
  'https://www.riotgames.com/en/',
  'https://hollowknightsilksong.com/'
]

//* Create urls for lighthouse based on current values
// return an arrat of
// {
//     original: string,
//     mobile: URL,
//     desktop: URL
// }
const createFetchUrls = () => {
  let resultUrls = []

  for (const url of urls) {
    let urlObj = {
      mobile: '',
      desktop: '',
      original: url
    }

    for (const strategy of strategies) {
      const u = new URL(
        'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed'
      )
      u.searchParams.set('key', API_KEY)
      u.searchParams.set('url', url)
      u.searchParams.set('strategy', strategy)
      categories.forEach(category => {
        u.searchParams.append('category', category)
      })

      if (strategy === 'MOBILE') urlObj.mobile = u
      if (strategy === 'DESKTOP') urlObj.desktop = u
    }

    resultUrls.push(urlObj)
  }

  return resultUrls
}

//* Simple fetch to call API
// * return the json result or null if error
const getData = async evaluationUrl => {
  try {
    const response = await fetch(evaluationUrl)

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error(`Error fetching data: ${error.message}`)
    return null
  }
}

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
const createReportObject = (originalUrl, mobileData, desktopData) => {
  const mobileObjData = mobileData ? extractFields(mobileData) : {}
  const desktopObjData = desktopData ? extractFields(desktopData) : {}

  return {
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

const generateFileName = () => {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0') // 0-11 → 1-12
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}-${hours}-${minutes}`
}

async function run () {
  let nonResult = []
  let reportsArray = []

  // arreglo de objetos con las urls para evaluar mobile y desktop
  const urlArray = createFetchUrls()

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

  //*  CODE FOR CSV FILE GENERATION
  //   if (nonResult.length > 0) {
  //     console.log('URLs with no results:')
  //     nonResult.forEach(url => console.log(url.toString()))
  //   }

  //   if (reportsArray.length > 0) {
  //     const csv = parse(reportsArray)
  //     const filename = generateFileName()
  //     const filePath = './lighthouse_reports.csv'

  //     writeFileSync(filePath, csv)
  //     console.log(`CSV file saved to ${filePath}`)
  //   } else {
  //     console.log('No successful results to write to CSV.')
  //   }
}

run()
