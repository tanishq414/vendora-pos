
function promptAndAddToCart(itemId) {
  const quantity = prompt('Enter quantity:');
  if (quantity) {
    const price = prompt('Enter price:');
    if (price) {
      addItemToCartById(itemId, quantity, price);
    }
  }
}
