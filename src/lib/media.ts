import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const BUCKET = 'sporthub-media';
const MAX_IMAGE_SIZE = 6 * 1024 * 1024;
let photoPickerOpen = false;

export async function pickPhoto(aspect: [number, number]) {
  // Prevent rapid taps from opening multiple native picker sessions.
  if (photoPickerOpen) return null;
  photoPickerOpen = true;
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // iOS's crop confirmation adds an extra step; crop in the preview instead.
      allowsEditing: false,
      aspect,
      quality: 0.82,
    });
    return result.canceled ? null : result.assets[0] ?? null;
  } finally {
    photoPickerOpen = false;
  }
}

export async function pickPhotos(limit = 8) {
  if (photoPickerOpen) return [];
  photoPickerOpen = true;
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: Math.max(1, limit),
      quality: 0.82,
    });
    return result.canceled ? [] : result.assets;
  } finally {
    photoPickerOpen = false;
  }
}

export async function uploadPhoto(
  uri: string,
  ownerId: string,
  folder: 'profiles' | 'events' | 'posts',
  mimeType?: string | null,
) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('The selected photo could not be read.');
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_SIZE) {
    throw new Error('Choose a photo smaller than 6 MB.');
  }

  const contentType = mimeType?.startsWith('image/') ? mimeType : 'image/jpeg';
  const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const path = `${ownerId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
