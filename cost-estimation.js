// cost-estimation.js - Add this to your public/js folder

document.addEventListener('DOMContentLoaded', function() {
    // Cost estimation modal setup
    const costEstimationModal = document.getElementById('cost-estimation-modal');
    const procedureSelect = document.getElementById('procedure-select');
    const insuranceSelect = document.getElementById('insurance-select');
    const estimateBtn = document.getElementById('estimate-cost-btn');
    const resultContainer = document.getElementById('cost-estimate-results');
    
    if (!costEstimationModal) return;
    
    // Load common procedures
    loadCommonProcedures();
    
    // Handle form submission
    if (estimateBtn) {
      estimateBtn.addEventListener('click', async function() {
        const procedure = procedureSelect.value;
        const insurance = insuranceSelect.value;
        const zipCode = document.getElementById('cost-zip-code').value;
        
        if (!procedure || !zipCode) {
          resultContainer.innerHTML = '<div class="alert alert-warning">Please select a procedure and enter a ZIP code.</div>';
          return;
        }
        
        // Show loading state
        resultContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Calculating estimates...</p></div>';
        
        try {
          const response = await fetch('/api/cost-compare', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              procedureName: procedure,
              zipCode: zipCode,
              insuranceType: insurance,
              radius: 25
            })
          });
          
          const data = await response.json();
          
          if (data.providers.length === 0) {
            resultContainer.innerHTML = '<div class="alert alert-info">No cost information found for this procedure in your area.</div>';
            return;
          }
          
          // Display results
          displayCostResults(data, insurance);
          
        } catch (error) {
          console.error('Error fetching cost estimates:', error);
          resultContainer.innerHTML = '<div class="alert alert-danger">An error occurred while fetching cost estimates. Please try again.</div>';
        }
      });
    }
    
    // Load common medical procedures
    async function loadCommonProcedures() {
      try {
        const response = await fetch('/api/common-procedures');
        const procedures = await response.json();
        
        procedureSelect.innerHTML = '<option value="">Select a procedure...</option>';
        
        procedures.forEach(proc => {
          const option = document.createElement('option');
          option.value = proc.name;
          option.textContent = proc.name;
          procedureSelect.appendChild(option);
        });
        
      } catch (error) {
        console.error('Error loading procedures:', error);
        procedureSelect.innerHTML = '<option value="">Error loading procedures</option>';
      }
    }
    
    // Display cost comparison results
    function displayCostResults(data, insuranceType) {
      const providers = data.providers;
      
      // Sort by cost
      providers.sort((a, b) => a.averageCost - b.averageCost);
      
      let html = `
        <h4 class="mb-3">Cost Estimates for ${data.procedureName}</h4>
        <p class="text-muted mb-4">Showing ${providers.length} providers near ${data.location}</p>
        <div class="table-responsive">
          <table class="table table-bordered table-hover">
            <thead class="table-light">
              <tr>
                <th>Provider</th>
                <th>Average Cost</th>
                <th>Range</th>
                <th>Distance</th>
                <th>Options</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      providers.forEach(provider => {
        // Apply insurance adjustment if applicable
        let adjustedCost = provider.averageCost;
        let adjustedMin = provider.minCost;
        let adjustedMax = provider.maxCost;
        let discount = '';
        
        if (insuranceType !== 'none') {
          // Simple simulation of insurance discount
          if (insuranceType === 'private') {
            adjustedCost = Math.round(provider.averageCost * 0.6);
            adjustedMin = Math.round(provider.minCost * 0.6);
            adjustedMax = Math.round(provider.maxCost * 0.6);
            discount = '<span class="badge bg-success">40% Insurance Discount</span>';
          } else if (insuranceType === 'medicare') {
            adjustedCost = Math.round(provider.averageCost * 0.45);
            adjustedMin = Math.round(provider.minCost * 0.45);
            adjustedMax = Math.round(provider.maxCost * 0.45);
            discount = '<span class="badge bg-success">55% Medicare Rate</span>';
          } else if (insuranceType === 'medicaid') {
            adjustedCost = Math.round(provider.averageCost * 0.4);
            adjustedMin = Math.round(provider.minCost * 0.4);
            adjustedMax = Math.round(provider.maxCost * 0.4);
            discount = '<span class="badge bg-success">60% Medicaid Rate</span>';
          }
        }
        
        const paymentOptions = [];
        if (provider.paymentOptions.slidingScale) {
          paymentOptions.push('<span class="badge bg-info">Sliding Scale</span>');
        }
        if (provider.paymentOptions.freeCare) {
          paymentOptions.push('<span class="badge bg-success">Free Care Available</span>');
        }
        if (provider.paymentOptions.financialAssistance) {
          paymentOptions.push('<span class="badge bg-primary">Financial Assistance</span>');
        }
        
        html += `
          <tr>
            <td>
              <strong>${provider.facilityName}</strong><br>
              <small class="text-muted">${provider.facilityType}</small>
            </td>
            <td>
              <strong>$${adjustedCost.toLocaleString()}</strong><br>
              ${discount}
            </td>
            <td>$${adjustedMin.toLocaleString()} - $${adjustedMax.toLocaleString()}</td>
            <td>${provider.distance.toFixed(1)} miles</td>
            <td>
              ${paymentOptions.join(' ')}
              <br>
              <a href="#" class="view-provider-details small" data-id="${provider.facilityId}">View Details</a>
            </td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
        </div>
        <div class="small text-muted mt-3">
          <p><strong>Note:</strong> These cost estimates are approximate and may vary. Contact the healthcare provider for exact pricing.</p>
        </div>
      `;
      
      resultContainer.innerHTML = html;
      
      // Add event listeners to view details links
      document.querySelectorAll('.view-provider-details').forEach(link => {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          const facilityId = this.getAttribute('data-id');
          showFacilityDetails(facilityId);
        });
      });
    }
  });