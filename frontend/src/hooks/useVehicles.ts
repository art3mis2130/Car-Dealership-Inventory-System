import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../lib/api.js';
import type { SearchMeta, Vehicle, VehicleFilters } from '../types/index.js';

interface UseVehiclesResult {
  vehicles: Vehicle[];
  meta: SearchMeta;
  makes: string[];
  categories: string[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Swaps one vehicle in place, so a purchase does not refetch the page. */
  replaceVehicle: (vehicle: Vehicle) => void;
  removeVehicle: (id: string) => void;
}

const EMPTY_META: SearchMeta = { total: 0, page: 1, limit: 12, totalPages: 1 };

/**
 * Loads the vehicle list for a set of filters.
 *
 * Requests are aborted when the filters change again before the previous one
 * lands, so a fast typist cannot have an old response overwrite a newer one.
 */
export function useVehicles(filters: VehicleFilters): UseVehiclesResult {
  const { api } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [meta, setMeta] = useState<SearchMeta>(EMPTY_META);
  const [makes, setMakes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  // The filter object is recreated on every render, so depend on its content.
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .searchVehicles(JSON.parse(filterKey) as VehicleFilters, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setVehicles(result.vehicles);
        setMeta(result.meta ?? EMPTY_META);
      })
      .catch((cause: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setError(cause instanceof ApiError ? cause.message : 'Could not load the inventory');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, filterKey, reloadToken]);

  // Filter options only change when the catalogue does, so they are fetched
  // alongside a reload rather than on every keystroke.
  useEffect(() => {
    let cancelled = false;

    api
      .filterOptions()
      .then((options) => {
        if (cancelled) return;
        setMakes(options.makes);
        setCategories(options.categories);
      })
      .catch(() => {
        // Non-fatal: the dropdowns simply fall back to "All".
      });

    return () => {
      cancelled = true;
    };
  }, [api, reloadToken]);

  const replaceVehicle = useCallback((updated: Vehicle) => {
    setVehicles((current) =>
      current.map((vehicle) => (vehicle.id === updated.id ? updated : vehicle)),
    );
  }, []);

  const removeVehicle = useCallback((id: string) => {
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
    setMeta((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
  }, []);

  return {
    vehicles,
    meta,
    makes,
    categories,
    loading,
    error,
    refresh,
    replaceVehicle,
    removeVehicle,
  };
}
