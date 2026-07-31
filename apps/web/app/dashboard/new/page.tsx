import { CreateTruckForm } from '@/components/dashboard/create-truck-form'

export default function NewTruckPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Create your truck</h1>
      <p className="mt-1 text-gray-500">
        You&apos;ll become its owner and be upgraded to an operator account.
      </p>
      <CreateTruckForm />
    </main>
  )
}
