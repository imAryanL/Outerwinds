// Photos from the camera or library can run several MB and carry EXIF rotation that a
// plain <img> tag in printed HTML won't respect — and on iOS, printed HTML can't load
// local file:// photos at all (WKWebView limitation). Re-rendering through
// expo-image-manipulator fixes both at once: it bakes in the correct orientation as
// real pixels and gives us a resized, base64 result to inline directly.

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Long enough to read clearly when printed, short of turning every export into a
// multi-megabyte file.
const MAX_WIDTH = 1600;

export async function photoToPdfDataUri(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_WIDTH });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });

  return `data:image/jpeg;base64,${result.base64}`;
}
