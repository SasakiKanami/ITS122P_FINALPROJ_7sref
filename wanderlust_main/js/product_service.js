// productService.js
import { getDatabase, ref, onValue, push, set, update, remove } from 'firebase/database';

const db = getDatabase();
const PRODUCTS_REF = 'products'; // Shared reference path

// READ: Get all products (used by both admin and user)
export const getAllProducts = (callback) => {
  const productsRef = ref(db, PRODUCTS_REF);
  
  onValue(productsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      // Transform object to array with IDs
      const productsArray = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      callback(productsArray);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Error fetching products:', error);
    callback([]);
  });
};

// CREATE: Add new product (admin only)
export const addProduct = async (productData) => {
  const productsRef = ref(db, PRODUCTS_REF);
  const newProductRef = push(productsRef);
  await set(newProductRef, {
    ...productData,
    createdAt: Date.now()
  });
  return newProductRef.key;
};

// UPDATE: Edit product (admin only)
export const updateProduct = async (productId, updatedData) => {
  const productRef = ref(db, `${PRODUCTS_REF}/${productId}`);
  await update(productRef, updatedData);
};

// DELETE: Remove product (admin only)
export const deleteProduct = async (productId) => {
  const productRef = ref(db, `${PRODUCTS_REF}/${productId}`);
  await remove(productRef);
};