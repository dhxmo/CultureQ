interface QlooEntity {
  name: string;
  entity_id: string;
  popularity: number;
  affinity: number;
  audience_growth: number;
}

interface AttachedBrand {
  merchantName: string;
  brands: QlooEntity[];
}

const searchEntityByName = async (
  brandName: string,
): Promise<string | null> => {
  try {
    const response = await fetch("/api/qloo/search-entity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ brandName }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return json.entity_id;
  } catch (error) {
    console.error(`Error searching for entity ${brandName}:`, error);
    return null;
  }
};

const getAttachedBrands = async (
  entityId: string,
  city: string = "New York",
  userAge: number = 28,
): Promise<QlooEntity[]> => {
  try {
    const response = await fetch("/api/qloo/attached-brands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entityId, city, userAge }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return json.brands || [];
  } catch (error) {
    console.error(
      `Error getting attached brands for entity ${entityId}:`,
      error,
    );
    return [];
  }
};

export const getAttachedBrandsForMerchants = async (
  merchantNames: string[],
  userAge: number = 28,
  userCity: string = "New York",
): Promise<AttachedBrand[]> => {
  // Deduplicate merchant names to avoid duplicate API calls
  const uniqueMerchantNames = [...new Set(merchantNames)];
  console.log(`Processing ${uniqueMerchantNames.length} unique merchants (${merchantNames.length} total)`);
  
  // Process merchants in parallel for better performance
  const promises = uniqueMerchantNames.map(async (merchantName) => {
    const entityId = await searchEntityByName(merchantName);
    if (entityId) {
      const brands = await getAttachedBrands(entityId, userCity, userAge);
      return {
        merchantName,
        brands,
      };
    }
    return {
      merchantName,
      brands: [],
    };
  });

  const results = await Promise.all(promises);
  return results.filter((result) => result.brands.length > 0);
};

export const isQlooCacheExpired = (lastFetch: number | null): boolean => {
  if (!lastFetch) return true;

  const oneWeekMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  const now = Date.now();

  return now - lastFetch > oneWeekMs;
};

// Check if cache is invalidated due to user preference changes
export const isCacheInvalidatedByPreferences = (
  cacheAge: number | null,
  cacheLocation: string | null,
  cacheExcluded: string[],
  currentAge: number,
  currentLocation: string,
  currentExcluded: string[]
): boolean => {
  if (cacheAge !== currentAge) return true;
  if (cacheLocation !== currentLocation) return true;
  
  // Check if excluded merchants have changed
  if (cacheExcluded.length !== currentExcluded.length) return true;
  const sortedCache = [...cacheExcluded].sort();
  const sortedCurrent = [...currentExcluded].sort();
  return sortedCache.some((merchant, index) => merchant !== sortedCurrent[index]);
};
