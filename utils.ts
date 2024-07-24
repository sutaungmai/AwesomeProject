import {ReceiptFormat} from './types';

export function formatNumber(value: any) {
  const number = Number(value);
  return number.toFixed(2).replace('.', ',');
}

export const formatDate = (date: Date) => {
  const options: any = {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  };
  const formattedDate = date
    .toLocaleDateString('de-DE', options)
    .replace(/\./g, '.');
  const formattedTime = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${formattedDate} ${formattedTime}`;
};

export function padString(str: string, width: number, alignRight = false) {
  if (str.length >= width) {
    return str.slice(0, width);
  } else {
    const padding = ' '.repeat(width - str.length);
    return alignRight ? padding + str : str + padding;
  }
}

export function formatReceiptItem(products: ReceiptFormat[]) {
  const productColumnWidth = 39;
  const quantityColumnWidth = 6;
  const priceColumnWidth = 18;

  let productItems = '';

  products.forEach(product => {
    const productLines = [];
    let ItemName = product.name;
    while (ItemName.length > productColumnWidth) {
      let line = ItemName.slice(0, productColumnWidth);
      productLines.push(line);
      ItemName = ItemName.slice(productColumnWidth);
    }
    productLines.push(ItemName);

    const quantityStr = padString(
      product.quantity.toString(),
      quantityColumnWidth,
      true,
    );
    const multiplySymbol = '      x   ';
    const priceStr = padString(
      formatNumber(product.price),
      priceColumnWidth - multiplySymbol.length,
      true,
    );

    const formattedLines = productLines.map((line, index) => {
      if (index === 0) {
        return (
          padString(line, productColumnWidth) +
          quantityStr +
          multiplySymbol +
          priceStr
        );
      } else {
        return padString(line, productColumnWidth);
      }
    });

    product.extras.forEach(extra => {
      let extraProduct = '  ' + extra.name;
      const extraLines = [];
      while (extraProduct.length > productColumnWidth) {
        let line = extraProduct.slice(0, productColumnWidth);
        extraLines.push(line);
        extraProduct = extraProduct.slice(productColumnWidth);
      }
      extraLines.push(
        extraLines.length > 0 ? '  ' + extraProduct : extraProduct,
      );

      extraLines.forEach((line, index) => {
        if (index === 0) {
          const extraQuantityStr = padString(
            extra.quantity.toString(),
            quantityColumnWidth,
            true,
          );
          const extraPriceStr = padString(
            formatNumber(extra.price),
            priceColumnWidth - multiplySymbol.length,
            true,
          );
          formattedLines.push(
            padString(line, productColumnWidth) +
              extraQuantityStr +
              multiplySymbol +
              extraPriceStr,
          );
        } else {
          formattedLines.push(padString(line, productColumnWidth));
        }
      });
    });

    productItems += formattedLines.join('\n');
  });
  return productItems;
}

export function formatSubtotal(
  subtotal: string,
  totalMva: string,
  discount: string,
) {
  const separator =
    '--------------------------------------------------------------';
  let summaryLines = [];

  summaryLines.push('\n');
  summaryLines.push(separator);
  summaryLines.push(
    padString('Subtotal:', 45, true) + padString(subtotal, 18, true),
  );
  summaryLines.push(
    padString('Herav MVA:', 45, true) + padString(totalMva, 18, true),
  );
  summaryLines.push(
    padString('Discount:', 45, true) + padString(discount, 18, true),
  );
  summaryLines.push(separator);

  return summaryLines.join('\n');
}
