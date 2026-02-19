import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import './Table.css'
import { deleteProfile, startEdit } from '../store/profilesSlice'
import { fetchIndiaCities, fetchIndiaStates } from '../services/locationService'

const COUNTRY_OPTIONS = ['All', 'India', 'Non-Indian Resident']

function initials(firstName, lastName) {
  const a = (firstName || '').trim().slice(0, 1).toUpperCase()
  const b = (lastName || '').trim().slice(0, 1).toUpperCase()
  return (a + b) || '?'
}

export default function Table() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const items = useSelector((s) => s.profiles.items)

  const [filters, setFilters] = useState({
    country: 'All',
    state: '',
    district: '',
  })

  const [stateOptions, setStateOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [loadingStates, setLoadingStates] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(false)

  const [openMenuId, setOpenMenuId] = useState(null)

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (filters.country !== 'All' && p.country !== filters.country) return false
      if (filters.country === 'India') {
        if (filters.state && p.state !== filters.state) return false
        if (filters.district && p.district !== filters.district) return false
      }
      return true
    })
  }, [items, filters])

  const handleEdit = (id) => {
    dispatch(startEdit(id))
    setOpenMenuId(null)
    navigate('/')
  }

  const handleDelete = (id) => {
    setOpenMenuId(null)
    const ok = confirm('Delete this user entry?')
    if (!ok) return
    dispatch(deleteProfile(id))
  }

  return (
    <section className="table-section" aria-label="Submitted users table">
      <div className="table-header">
        <div>
          <h2 className="table-title">Submitted users</h2>
          <p className="table-subtitle">
            {filtered.length} showing / {items.length} total
          </p>
        </div>
        <button
          type="button"
          className="table-nav-btn"
          onClick={() => navigate('/')}
        >
          New entry
        </button>
      </div>

      <div className="filters">
        <div className="filter">
          <label className="filter-label" htmlFor="filter-country">
            Country
          </label>
          <select
            id="filter-country"
            className="filter-select"
            value={filters.country}
            onChange={(e) => {
              const next = e.target.value
              setFilters({ country: next, state: '', district: '' })
              setStateOptions([])
              setDistrictOptions([])
              setLoadingDistricts(false)

              if (next === 'India') {
                setLoadingStates(true)
                fetchIndiaStates()
                  .then((states) => setStateOptions(states))
                  .catch(() => setStateOptions([]))
                  .finally(() => setLoadingStates(false))
              } else {
                setLoadingStates(false)
              }
              setOpenMenuId(null)
            }}
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label className="filter-label" htmlFor="filter-state">
            State
          </label>
          <select
            id="filter-state"
            className="filter-select"
            value={filters.state}
            onChange={(e) => {
              const next = e.target.value
              setFilters((p) => ({ ...p, state: next, district: '' }))
              setDistrictOptions([])
              setLoadingDistricts(false)

              if (next) {
                setLoadingDistricts(true)
                fetchIndiaCities(next)
                  .then((districts) => setDistrictOptions(districts))
                  .catch(() => setDistrictOptions([]))
                  .finally(() => setLoadingDistricts(false))
              }
              setOpenMenuId(null)
            }}
            disabled={filters.country !== 'India' || loadingStates}
          >
            <option value="">
              {filters.country !== 'India'
                ? 'Select India first'
                : loadingStates
                  ? 'Loading...'
                  : 'All states'}
            </option>
            {stateOptions.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label className="filter-label" htmlFor="filter-district">
            District / City
          </label>
          <select
            id="filter-district"
            className="filter-select"
            value={filters.district}
            onChange={(e) =>
              setFilters((p) => ({ ...p, district: e.target.value }))
            }
            disabled={
              filters.country !== 'India' || !filters.state || loadingDistricts
            }
          >
            <option value="">
              {filters.country !== 'India'
                ? 'Select India first'
                : !filters.state
                  ? 'Select state first'
                  : loadingDistricts
                    ? 'Loading...'
                    : 'All districts'}
            </option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Full name</th>
              <th>Email</th>
              <th>Country</th>
              <th>State</th>
              <th>District / City</th>
              <th>Pin code</th>
              <th>Username</th>
              <th>Avatar</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty">
                  No submitted users yet. Fill the form and click Save.
                </td>
              </tr>
            ) : (
              filtered.map((p, idx) => (
                <tr key={p.id}>
                  <td className="mono">{idx + 1}</td>
                  <td className="strong">
                    {(p.firstName || '') + ' ' + (p.lastName || '')}
                  </td>
                  <td className="mono">{p.email}</td>
                  <td>{p.country}</td>
                  <td>{p.country === 'India' ? p.state : '—'}</td>
                  <td>{p.country === 'India' ? p.district : '—'}</td>
                  <td className="mono">{p.country === 'India' ? p.postalCode : '—'}</td>
                  <td className="mono">{p.username}</td>
                  <td>
                    {p.avatarDataUrl ? (
                      <img
                        className="avatar"
                        src={p.avatarDataUrl}
                        alt={`${p.firstName || 'User'} avatar`}
                      />
                    ) : (
                      <div className="avatar avatar--fallback">
                        {initials(p.firstName, p.lastName)}
                      </div>
                    )}
                  </td>
                  <td className="actions">
                    <button
                      type="button"
                      className="menu-btn"
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === p.id}
                      onClick={() =>
                        setOpenMenuId((cur) => (cur === p.id ? null : p.id))
                      }
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openMenuId === p.id && (
                      <div className="menu" role="menu">
                        <button
                          type="button"
                          className="menu-item"
                          role="menuitem"
                          onClick={() => handleEdit(p.id)}
                        >
                          <Pencil size={16} />
                          Update
                        </button>
                        <button
                          type="button"
                          className="menu-item menu-item--danger"
                          role="menuitem"
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

