import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './config';
import { auth } from './config';

/**
 * Upload a file to Cloud Storage under /reports/{userId}/
 * Storage rules enforce per-user write access.
 */
export async function uploadReportFile(
  file: File,
  fileName?: string
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be authenticated to upload files');

  const name = fileName || `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `reports/${user.uid}/${name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}

/**
 * Get download URL for a file path
 */
export async function getFileURL(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}
