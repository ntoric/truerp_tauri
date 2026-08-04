import { redirect } from 'next/navigation'

export default function CreateWarehousePage() {
  redirect('/warehouses?create=true')
}
