import BASE_URL from "../../Config";
import type { CodeFile } from "../type/file";

// Usecases API functions
export async function fetchUsecases(): Promise<CodeFile[]> {
  const response = await fetch(`${BASE_URL}/vibecode-service/usecases`);
  if (!response.ok) throw new Error("Failed to fetch usecases");
  return response.json();
}

export async function fetchUsecaseTitles(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/vibecode-service/usecases/titles`);
  if (!response.ok) throw new Error("Failed to fetch usecase titles");
  return response.json();
}

export async function fetchUsecaseChildren(usecaseId: string): Promise<CodeFile[]> {
  const response = await fetch(`${BASE_URL}/vibecode-service/usecases/${usecaseId}/children`);
  if (!response.ok) throw new Error(`Failed to fetch children for usecase: ${usecaseId}`);
  return response.json();
}

export async function fetchUsecaseFiles(title: string): Promise<CodeFile[]> {
  const response = await fetch(`${BASE_URL}/vibecode-service/usecases?title=${encodeURIComponent(title)}`);
  if (!response.ok) throw new Error(`Failed to fetch files for usecase: ${title}`);
  return response.json();
}
