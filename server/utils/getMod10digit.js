let getBarcode = (barcode) => {
    let sum = 0;
    let sum1 = 0;
    let odd = true;
    for (let i = barcode.length - 1; i >= 0; i--)
    {
        if (odd == true)
        {
            let tSum = parseInt((barcode[i].toString())) * 2;
            if (tSum >= 10)
            {
                let tData = tSum.toString();
                tSum = parseInt(tData[0].toString()) +parseInt(tData[1].toString());
            }
            sum1 += tSum;
        }
        else
            sum += parseInt(barcode[i].toString());
        odd = !odd;
    }

    let checkDigit = (sum + sum1) % 10;
    let result = barcode.padStart(8,"0") + checkDigit;
    return result;
}

module.exports = getBarcode;