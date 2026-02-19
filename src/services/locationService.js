export async function fetchIndiaStates() {
  const response = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: 'India' }),
  })
  const data = await response.json()
  if (data?.error) return []
  return data?.data?.states || []
}

export async function fetchIndiaCities(stateName) {
  const response = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: 'India', state: stateName }),
  })
  const data = await response.json()
  if (data?.error) return []
  return data?.data || []
}

export async function fetchPincodesByDistrict(districtName) {
  const response = await fetch(
    `https://api.postalpincode.in/postoffice/${encodeURIComponent(districtName)}`,
  )
  const data = await response.json()
  if (!Array.isArray(data) || data.length === 0) return []
  if (data[0]?.Status !== 'Success') return []
  return data[0]?.PostOffice || []
}

