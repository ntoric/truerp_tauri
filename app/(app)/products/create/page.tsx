import { redirect } from 'next/navigation'

export default function CreateProductPage() {
  redirect('/products?create=true')
}
