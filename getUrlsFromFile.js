import fs from 'fs'
import path from 'path'

export async function readSitesFile (fileName, isCsv = false) {
  const filePath = path.resolve('./', fileName)
  console.log({ filePath })

  try {
    const data = await fs.promises.readFile(filePath, 'utf8')

    const rows = data.split('\n')
    const sitesData = rows.map(row => {
      const cleanRow = row.trim()
      const [ruta, pantalla, url] = cleanRow.split(isCsv ? ',' : '\t')

      return { ruta, pantalla, url }
    })
    
    return sitesData
  } catch (err) {
    console.error('Error al leer el archivo:', err)
    throw err
  }
}
