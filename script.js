function toggleCollapsible(elementId, buttonElement) {
        const content = document.getElementById(elementId);
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            buttonElement.classList.add('active');
        } else {
            content.style.display = 'none';
            buttonElement.classList.remove('active');
        }
    }

    // Standard Geometric Martingale Lot Sizing
    function getLotSizeForLayer(layerIndex, martingaleFactor, baseLotSize = 0.01) {
        if (martingaleFactor < 1) martingaleFactor = 1; 
        let lotMultiplier = Math.pow(martingaleFactor, layerIndex);
        return parseFloat((baseLotSize * lotMultiplier).toFixed(2));
    }

    function simulateBustForGivenX(pipSpacingX, spread, budget, martingaleFactor) {
        const baseLotSize = 0.01;
        const valuePerPipPerBaseMinLot = 0.10; 
        const pipIncrement = 0.01; 
        
        let maxYCheck = (budget / valuePerPipPerBaseMinLot) + (50 * spread) + 200; 
        if (pipSpacingX > 0 && pipSpacingX < 1) maxYCheck += (100 / pipSpacingX) * spread;
        if (martingaleFactor > 1.05) { // More sensitive adjustment for MF
            let firstLayerLot = getLotSizeForLayer(0, martingaleFactor, baseLotSize);
            let firstLayerPipValue = (firstLayerLot / baseLotSize) * valuePerPipPerBaseMinLot;
             // If first layer alone can bust the budget, maxYCheck can be much smaller.
            if (firstLayerPipValue > 0) {
                 maxYCheck = Math.min(maxYCheck, (budget / firstLayerPipValue) + spread + pipSpacingX + 50); // Add some buffer for spacing and subsequent layers
            }
        }
        // Ensure maxYCheck is at least the targetY value from the input field, plus a buffer, or a default minimum.
        const targetYInputElement = document.getElementById('targetY'); 
        const targetYString = targetYInputElement ? targetYInputElement.value : "0"; 
        const targetYValueSim = parseFloat(targetYString);
        maxYCheck = Math.max(maxYCheck, Math.max(50, targetYValueSim ? targetYValueSim + 50 : 50) );


        let y = 0.0;

        for (let currentY = pipIncrement; currentY <= maxYCheck; currentY += pipIncrement) {
            y = parseFloat(currentY.toFixed(Math.max(2, (pipIncrement.toString().split('.')[1] || '').length)));
            
            let numLayersOpen = Math.floor(y / pipSpacingX) + 1;
            let totalDollarLoss = 0; 

            for (let i = 0; i < numLayersOpen; i++) { 
                let pipsMovedAgainstLayer_i = y - (i * pipSpacingX);
                
                if (pipsMovedAgainstLayer_i >= 0) { 
                    const currentLayerLotSize = getLotSizeForLayer(i, martingaleFactor, baseLotSize);
                    if (currentLayerLotSize <= 0) continue; 
                    const pipValueForCurrentLayer = (currentLayerLotSize / baseLotSize) * valuePerPipPerBaseMinLot;
                    totalDollarLoss += (pipsMovedAgainstLayer_i + spread) * pipValueForCurrentLayer;
                }
            }
            
            if (totalDollarLoss >= budget) {
                return { 
                    yBust: parseFloat(y.toFixed(2)),
                    layersAtBust: numLayersOpen 
                };
            }
        }
        console.warn(`Sim for X=${pipSpacingX.toFixed(1)},S=${spread.toFixed(1)},B=${budget.toFixed(2)},MF=${martingaleFactor.toFixed(4)} did not bust in maxY=${maxYCheck.toFixed(2)}`);
        return null; 
    }

    function findBestXForTargetY(targetY, spread, budget, martingaleFactor) {
        let bestX = null;
        let minDifference = Infinity;
        let actualYBustForBestX = null;
        let layersForBestX = null;

        const xMin = 0.1;
        let xMax = Math.max(75.0, targetY + 50 + (20 * spread)); 
        if (martingaleFactor > 1.05 && targetY < budget / (martingaleFactor * 1.2) ) { 
             xMax = Math.max(xMax, targetY * martingaleFactor * 1.5 + 100); 
        }
         xMax = Math.max(xMax, targetY + (martingaleFactor > 1.05 ? 100 : 50) ); 
        xMax = Math.min(xMax, 400); 
        const xStep = 0.1;

        for (let currentTestX = xMin; currentTestX <= xMax; currentTestX += xStep) {
            const currentTestXRounded = parseFloat(currentTestX.toFixed(1)); 
            if (currentTestXRounded <= 0) continue; 
            const simulationResult = simulateBustForGivenX(currentTestXRounded, spread, budget, martingaleFactor);

            if (simulationResult) {
                const calculatedY = simulationResult.yBust;
                const difference = Math.abs(calculatedY - targetY);

                if (difference < minDifference) {
                    minDifference = difference;
                    bestX = currentTestXRounded;
                    actualYBustForBestX = calculatedY;
                    layersForBestX = simulationResult.layersAtBust;
                } 
            }
        }

        if (bestX !== null) {
            return {
                bestXValue: bestX,
                calculatedYForBestX: actualYBustForBestX,
                layersAtBust: layersForBestX,
                differenceFromTargetY: minDifference
            };
        } else {
             return { error: `Could not find a suitable X-value. Target Y (${targetY.toFixed(2)}) might be outside achievable range for tested X (up to ${xMax.toFixed(1)} pips), Budget ($${budget.toFixed(2)}), Spread (${spread.toFixed(1)}), and Martingale Factor (${martingaleFactor.toFixed(4)}). Consider adjusting inputs, or the X-range logic in the code if using extreme Martingale factors or unusual budget/Y combinations.` };
        }
    }

    function findAndDisplayX() {
        const resultsDiv = document.getElementById('results');
        const processingMsg = document.getElementById('processingMessage');
        const budgetString = document.getElementById('budgetUSD').value;
        const targetYString = document.getElementById('targetY').value; 
        const spreadString = document.getElementById('spreadPips').value;
        const martingaleFactorString = document.getElementById('martingaleFactor').value;
        
        resultsDiv.style.display = 'none';
        resultsDiv.innerHTML = ''; 
        processingMsg.style.display = 'none';

        let hasError = false;
        let errorMsg = '';

        const budgetValue = parseFloat(budgetString);
        const targetYValue = parseFloat(targetYString); 
        const spreadValue = parseFloat(spreadString);
        const martingaleFactorValue = parseFloat(martingaleFactorString);

        if (budgetString.trim() === "" || isNaN(budgetValue) || budgetValue <= 0) {
            errorMsg += '<p>Budget must be a positive number (e.g., 100).</p>';
            hasError = true;
        }
        if (targetYString.trim() === "" || isNaN(targetYValue) || targetYValue <= 0) {
            errorMsg += '<p>Target Y-value (Pips to Bust) must be a positive number (e.g., 135).</p>';
            hasError = true;
        }
        if (spreadString.trim() === "" || isNaN(spreadValue) || spreadValue < 0) {
            errorMsg += '<p>Spread must be a non-negative number (e.g., 2.5 or 0).</p>';
            hasError = true;
        }
        if (martingaleFactorString.trim() === "" || isNaN(martingaleFactorValue) || martingaleFactorValue < 1) {
            errorMsg += '<p>Martingale Factor must be a number greater than or equal to 1.0000.</p>';
            hasError = true;
        }

        if (hasError) {
            resultsDiv.innerHTML = `<div class="error">${errorMsg}</div>`;
            resultsDiv.style.display = 'block';
            return;
        }
        
        processingMsg.style.display = 'block'; 

        setTimeout(() => {
            const result = findBestXForTargetY(targetYValue, spreadValue, budgetValue, martingaleFactorValue);
            processingMsg.style.display = 'none'; 

            if (result.error) {
                resultsDiv.innerHTML = `<p class="error">${result.error}</p>`;
            } else {
                resultsDiv.innerHTML = `
                    <h3>Calculation Results:</h3>
                    <p style="font-size: 1.1em;">Determined Optimal X-value (Pip Spacing): <span class="highlight-x">${result.bestXValue.toFixed(1)} pips</span></p>
                    <hr>
                    <p><strong>Input Parameters Used:</strong></p>
                    <ul>
                        <li>Budget: <strong>$${budgetValue.toFixed(2)} USD</strong></li>
                        <li>Target Y-value (Pips to Bust): <strong>${targetYValue.toFixed(2)} pips</strong></li>
                        <li>Spread: <strong>${spreadValue.toFixed(1)} pips</strong></li>
                        <li>Martingale Factor: <strong>${martingaleFactorValue.toFixed(4)}</strong></li>
                    </ul>
                    <p><strong>Achieved with this X-value:</strong></p>
                    <ul>
                        <li>Calculated Actual Y (Pips to Bust): <strong>${result.calculatedYForBestX.toFixed(2)} pips</strong></li>
                        <li>Number of Layers at Bust: <strong>${result.layersAtBust}</strong></li>
                        <li><em>(This X-value resulted in a calculated Y that is <strong>${result.differenceFromTargetY.toFixed(2)} pips</strong> away from your target Y.)</em></li>
                    </ul>
                `;
            }
            resultsDiv.style.display = 'block';
        }, 10); 
    }
