function setupBillingCalculations() {
  const itemSelect = document.getElementById('billItemSelect');
  const quantityInput = document.getElementById('billQuantity');
  const unitSelect = document.getElementById('billUnit');
  const priceInput = document.getElementById('billPrice');

  function updatePrice() {
    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    if (!selectedOption || selectedOption.value === '') {
      priceInput.style.display = 'none';
      unitSelect.style.display = 'none';
      return;
    }

    const itemType = selectedOption.dataset.type;
    if (itemType === 'loose') {
      unitSelect.style.display = 'inline-block';
      priceInput.style.display = 'inline-block';
      
      const pricePerKg = parseFloat(selectedOption.dataset.price) || 0;
      const quantity = parseFloat(quantityInput.value) || 0;
      const unit = unitSelect.value;
      
      let finalPrice = 0;
      if (unit === 'kg') {
        finalPrice = pricePerKg * quantity;
      } else { // grams
        finalPrice = (pricePerKg / 1000) * quantity;
      }
      priceInput.value = finalPrice.toFixed(2);
    } else {
      unitSelect.style.display = 'none';
      priceInput.style.display = 'none';
      priceInput.value = '';
    }
  }

  itemSelect.addEventListener('change', updatePrice);
  quantityInput.addEventListener('input', updatePrice);
  unitSelect.addEventListener('change', updatePrice);
}
