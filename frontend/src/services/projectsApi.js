/**
 * Projects API service. Reuses the shared authenticated axios instance so that
 * BTT pages never call axios directly (PRD NX-PRD-BTT-2026-08 ch.0.13).
 */
import { api } from '../context/AuthContext';

/**
 * List all projects of the current user (GET /api/projects).
 * @returns {Promise<Array<object>>} projects with id, name, status, etc.
 */
export async function listProjects() {
  const res = await api.get('/projects');
  return res.data;
}
