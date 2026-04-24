import { useEffect, useState } from 'react';
import projectService from '../services/projectService';

export default function useCoordinatorProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getProjects();
        setProjects(Array.isArray(res.data) ? res.data : res.data?.results || []);
      } catch {
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return {
    projects,
    loading,
    error,
  };
}
