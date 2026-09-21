// Photos from the camera or library can run several MB and carry EXIF rotation that a
// plain <img> tag in printed HTML won't respect — and on iOS, printed HTML can't load
// local file:// photos at all (WKWebView limitation). Re-rendering through
// expo-image-manipulator fixes both at once: it bakes in the correct orientation as
// real pixels and gives a resized result, as a file for the vault or base64 for a PDF.

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

// Long enough to read clearly when printed, short of turning every export into a
// multi-megabyte file.
const MAX_PDF_WIDTH = 1600;

// Bigger than the PDF cap — this is the copy the in-app viewer zooms into, so it needs
// real detail. Still far short of a fresh camera photo's native resolution (often
// 12MP+, sometimes much more), which is what made pinch/pan laggy before this existed.
const MAX_VAULT_WIDTH = 2400;

function getImageWidth(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width) => resolve(width), reject);
  });
}

// Never resize UP — a small library image or an already-normalized vault copy
// shouldn't be blown up past its real resolution.
async function manipulate(uri: string, maxWidth: number) {
  const width = await getImageWidth(uri);
  const context = ImageManipulator.manipulate(uri);
  if (width > maxWidth) {
    context.resize({ width: maxWidth });
  }
  return context.renderAsync();
}

export async function photoToPdfDataUri(uri: string): Promise<string> {
  const rendered = await manipulate(uri, MAX_PDF_WIDTH);
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });

  return `data:image/jpeg;base64,${result.base64}`;
}

// Called once, when a photo is first added to the vault — normalizing here (rather
// than only at PDF-export time) is what fixes the viewer's pinch/pan lag on fresh
// camera photos, and shrinks vault storage as a side benefit. Returns a local file URI.
export async function normalizePhotoForVault(uri: string): Promise<string> {
  const rendered = await manipulate(uri, MAX_VAULT_WIDTH);
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

  return result.uri;
}
