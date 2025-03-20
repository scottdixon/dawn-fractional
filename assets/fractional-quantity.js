// Remove the IIFE patch since we've added hidden buttons to the DOM

class FractionalQuantity extends HTMLElement {
  constructor() {
    super();
    this.productId = document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
    this.variantId = document.querySelector('input[name="id"]')?.value;
    this.sectionId = document.querySelector('[data-section]')?.getAttribute('data-section');
    this.fractionalInput = document.getElementById(`FractionalQuantity-${this.sectionId}`);
    this.quantityInput = this.querySelector('input[name="quantity"]');
    this.form = document.getElementById(`product-form-${this.sectionId}`);
    this.submitButton = document.querySelector('.product-form__submit');
    this.cartItemKey = null;
    this.originalButtonText = this.submitButton ? this.submitButton.textContent : '';
    this.updateTimeout = null;

    if (this.fractionalInput && this.productId) {
      // Validate fractional input
      this.fractionalInput.addEventListener('change', this.validateInput.bind(this));
      this.fractionalInput.addEventListener('keyup', this.validateInput.bind(this));

      // Check cart on load
      this.checkCartForProduct();

      // Handle variant changes if multiple variants
      document.addEventListener('variant:change', this.handleVariantChange.bind(this));
    }
  }

  validateInput(event) {
    const value = parseFloat(this.fractionalInput.value);
    const min = parseFloat(this.fractionalInput.getAttribute('min') || 0.01);

    if (isNaN(value) || value < min) {
      this.fractionalInput.value = min;
    }
  }

  handleVariantChange(event) {
    if (event.detail && event.detail.variant) {
      this.variantId = event.detail.variant.id;
      this.checkCartForProduct();
    }
  }

  checkCartForProduct() {
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        // Reset form to default state first
        this.resetForm();

        // Find if this product is already in the cart
        const cartItem = cart.items.find(item =>
          item.product_id === parseInt(this.productId) &&
          item.variant_id === parseInt(this.variantId) &&
          item.properties && item.properties.Units
        );

        if (cartItem) {
          // Update the form to show current value and change to update mode
          this.cartItemKey = cartItem.key;
          this.fractionalInput.value = cartItem.properties.Units;

          // Hide the form's purchase buttons
          this.form.classList.add('fractional-update-mode');

          // Hide dynamic checkout buttons if they exist
          const dynamicCheckout = document.querySelector('.shopify-payment-button');
          if (dynamicCheckout) {
            dynamicCheckout.style.display = 'none';
          }

          document.querySelector('.product-form__submit').style.display = 'none';

          // Add Update button
          this.addUpdateButton();

          // Add hidden field for item key
          const keyInput = document.createElement('input');
          keyInput.type = 'hidden';
          keyInput.name = 'cartItemKey';
          keyInput.value = this.cartItemKey;
          keyInput.classList.add('cart-item-key-input');
          this.form.appendChild(keyInput);
        }
      })
      .catch(error => {
        console.error('Error fetching cart:', error);
      });
  }

  // Add new method to create the update button
  addUpdateButton() {
    this.updateButton = document.createElement('button');
    this.updateButton.type = 'button';
    this.updateButton.classList.add('update-cart-button', 'button', 'button--full-width', 'product-form__submit', 'cart-update');
    this.updateButton.textContent = 'Update';
    this.updateButton.style.marginTop = '10px';
    this.updateButton.addEventListener('click', this.updateCartItem.bind(this));

    // Add after the quantity container
    const quantityContainer = this.fractionalInput.closest('.product-form__quantity');
    quantityContainer.after(this.updateButton);
  }

  resetForm() {
    // Reset form state
    this.form.classList.remove('fractional-update-mode');

    // Show dynamic checkout buttons if they exist
    const dynamicCheckout = document.querySelector('.shopify-payment-button');
    if (dynamicCheckout) {
      dynamicCheckout.style.display = '';
    }

    // Remove any existing key input
    const existingKeyInput = document.querySelector('.cart-item-key-input');
    if (existingKeyInput) existingKeyInput.remove();

    // Remove any existing messages
    const messages = document.querySelectorAll('.update-success-message, .update-error-message');
    messages.forEach(msg => msg.remove());

    // Remove the update button if it exists
    if (this.updateButton) {
      this.updateButton.remove();
      this.updateButton = null;
    }

    // Reset cartItemKey
    this.cartItemKey = null;
  }

  updateCartItem() {
    if (!this.cartItemKey) return;

    const unitsValue = this.fractionalInput.value;

    // Show loading state on the update button
    this.updateButton.disabled = true;
    this.updateButton.classList.add('loading');
    this.updateButton.textContent = ''; // Clear text to show spinner centered

    // Directly update the cart with the stored cartItemKey
    fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        id: this.cartItemKey,
        quantity: 1,
        properties: {
          'Units': unitsValue
        }
      })
    })
    .then(response => response.json())
    .then(updatedCart => {
      // Reset update button state
      this.updateButton.disabled = false;
      this.updateButton.classList.remove('loading');
      this.updateButton.textContent = 'Update';

      // Find the updated item in cart to get its new key
      const updatedItem = updatedCart.items.find(item =>
        item.product_id === parseInt(this.productId) &&
        item.variant_id === parseInt(this.variantId) &&
        item.properties && item.properties.Units
      );

      if (updatedItem) {
        // Store the new item key
        this.cartItemKey = updatedItem.key;
      }

      // Show cart drawer - no need for custom success message since the drawer has its own notification
      this.showCartDrawer(updatedCart);

      // Update the cart heading to show the item updated
      const cartHeading = document.querySelector('.cart-notification__heading');
      const svg = cartHeading.querySelector('svg');
      cartHeading.innerHTML = '';
      cartHeading.appendChild(svg);
      cartHeading.appendChild(document.createTextNode(' Item updated'));
    })
    .catch(error => {
      console.error('Error updating cart:', error);

      // Reset update button state
      this.updateButton.disabled = false;
      this.updateButton.classList.remove('loading');
      this.updateButton.textContent = 'Update';

      // Refresh the cart state to ensure we're in sync
      this.checkCartForProduct();
    });
  }

  showCartDrawer(cart) {
    const cartNotification = document.querySelector('cart-notification');
    cartNotification.setAttribute('open', true);
    cartNotification.open();
  }
}

customElements.define('fractional-quantity', FractionalQuantity);
