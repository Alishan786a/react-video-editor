import { API_ENDPOINTS } from "@/config/api";

interface IUploadDetails {
  uploadUrl: string;
  url: string;
  name: string;
  id: string;
  originalFileName: string;
  folder: string;
  uploadMethod: string;
  uploadHeaders: Record<string, string>;
}

interface IUploadResponse {
  success: boolean;
  presigned_url: string;
  url: string;
  id: string;
  fileName: string;
  originalFileName: string;
  folder: string;
  uploadMethod: string;
  uploadHeaders: Record<string, string>;
  error?: string;
}

export const createUploadsDetails = async (
  fileName: string
): Promise<IUploadDetails> => {
  const response = await fetch(API_ENDPOINTS.PRESIGNED_URL, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName })
  });

  if (!response.ok) {
    throw new Error(`Failed to get upload URL: ${response.statusText}`);
  }

  const data: IUploadResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get upload URL');
  }

  if (!data.presigned_url || !data.url) {
    throw new Error('Invalid response from upload service');
  }

  return {
    uploadUrl: data.presigned_url,
    url: data.url,
    name: data.fileName,
    id: data.id,
    originalFileName: data.originalFileName,
    folder: data.folder,
    uploadMethod: data.uploadMethod,
    uploadHeaders: data.uploadHeaders
  };
};
