import sharp from 'sharp'
import { NextRequest, NextResponse } from 'next/server'

const PRESETS: Record<string, { width: number; height: number } | null> = {
  noticias:   { width: 796,  height: 348  },
  ebooks:     { width: 1280, height: 960  },
  cuadrada:   { width: 1080, height: 1080 },
  'webp-only': null,
}

const TARGET_BYTES   = 100 * 1024       // 100 KB
const MAX_INPUT_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file   = formData.get('image')  as File | null
    const preset = (formData.get('preset') as string) ?? 'noticias'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó imagen' }, { status: 400 })
    }
    if (file.size > MAX_INPUT_BYTES) {
      return NextResponse.json({ error: 'La imagen no puede superar 20 MB' }, { status: 400 })
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer())
    const baseName    = file.name.replace(/\.[^.]+$/, '')

    let resizedBuffer: Buffer

    if (preset === 'webp-only') {
      // Solo convertir, sin redimensionar
      resizedBuffer = await sharp(inputBuffer).toBuffer()
    } else {
      let w: number, h: number

      if (preset === 'manual') {
        w = parseInt(formData.get('width')  as string)
        h = parseInt(formData.get('height') as string)
        if (!w || !h || w < 1 || h < 1 || w > 10000 || h > 10000) {
          return NextResponse.json(
            { error: 'Dimensiones inválidas. Usa valores entre 1 y 10000 px.' },
            { status: 400 },
          )
        }
      } else if (PRESETS[preset]) {
        const size = PRESETS[preset]!
        w = size.width
        h = size.height
      } else {
        return NextResponse.json({ error: 'Preset no válido' }, { status: 400 })
      }

      // Crop centrado + resize + nitidez (replicando la lógica del Colab)
      resizedBuffer = await sharp(inputBuffer)
        .resize(w, h, { fit: 'cover', position: 'center' })
        .sharpen({ sigma: 0.5 })
        .toBuffer()
    }

    // Compresión inteligente: bajar calidad progresivamente hasta < 100 KB
    let quality = 85
    let output  = await sharp(resizedBuffer).webp({ quality }).toBuffer()

    while (output.length > TARGET_BYTES && quality > 40) {
      quality -= 5
      output = await sharp(resizedBuffer).webp({ quality }).toBuffer()
    }

    return new NextResponse(output as unknown as BodyInit, {
      headers: {
        'Content-Type':        'image/webp',
        'Content-Disposition': `attachment; filename="${baseName}.webp"`,
        'X-Original-Size':     String(inputBuffer.length),
        'X-Output-Size':       String(output.length),
        'X-Quality-Used':      String(quality),
        'Access-Control-Expose-Headers':
          'X-Original-Size, X-Output-Size, X-Quality-Used',
      },
    })
  } catch (err) {
    console.error('Image processing error:', err)
    return NextResponse.json({ error: 'Error al procesar la imagen' }, { status: 500 })
  }
}
