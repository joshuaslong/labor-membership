Generate real 192x192 and 512x512 PNG icons from icon.svg for PWA support.
You can use tools like Inkscape, ImageMagick, or an online SVG-to-PNG converter.

Example with ImageMagick:
  convert -background none -resize 192x192 icon.svg icon-192.png
  convert -background none -resize 512x512 icon.svg icon-512.png
