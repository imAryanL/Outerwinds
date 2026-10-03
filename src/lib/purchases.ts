// RevenueCat setup. The only file that talks to the purchases SDK.

import Purchases, { type PurchasesPackage } from 'react-native-purchases';

// A public key, safe inside the app: it can start a purchase but can't read or spend anything.
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

// Called once when the app opens. Without a key, Pro just stays locked.
export function startPurchases() {
  if (!API_KEY) {
    return;
  }

  Purchases.configure({ apiKey: API_KEY });
}

// The name of what a purchase unlocks, as set up in the RevenueCat dashboard.
const PRO_ENTITLEMENT = 'outerwinds_pro';

// Throws when RevenueCat can't answer (never started, or nothing saved yet and no signal).
export async function hasProEntitlement(): Promise<boolean> {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
}

// The one thing for sale. Null when the store can't be reached or nothing is set up.
export async function getProPackage(): Promise<PurchasesPackage | null> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current === null) {
      return null;
    }
    return offerings.current.lifetime;
  } catch {
    return null;
  }
}

// Closing Apple's payment sheet is a normal answer, not a failure. Anything else throws.
export async function buyPro(proPackage: PurchasesPackage): Promise<'bought' | 'cancelled'> {
  try {
    await Purchases.purchasePackage(proPackage);
    return 'bought';
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return 'cancelled';
    }
    throw error;
  }
}

// True when a past purchase was found and Pro is back.
export async function restorePro(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
}
