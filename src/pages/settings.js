import { getServerSession } from 'next-auth/next'
import { useStore, initializeStore } from '@/lib/store'
import Head from 'next/head'
import Layout from '@/components/layout'
import Sidebar from '@/components/sidebar'
import { authOptions } from './api/auth/[...nextauth]'
import prisma from '@/lib/prisma'

export default function Settings() {
  const categories = useStore((state) => state.categories)
  const tags = useStore((state) => state.tags)
  return (
    <Layout>
      <Head>
        <title>Briefkasten | Settings</title>
      </Head>
      <Sidebar categories={categories} tags={tags} />
      <div className="flex flex-col space-y-4">
        <h2>Settings</h2>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(context) {
  const nextauth = await getServerSession(context, authOptions)
  const zustandStore = initializeStore()

  if (!nextauth) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    }
  }

  const categories = await prisma.category.findMany({
    where: {
      userId: nextauth.user.userId,
    },
  })
  const tags = await prisma.tag.findMany({
    where: {
      userId: nextauth.user.userId,
    },
  })

  zustandStore.getState().setCategories(categories)
  zustandStore.getState().setTags(tags)

  return {
    props: {
      nextauth,
      initialZustandState: JSON.parse(JSON.stringify(zustandStore.getState())),
    },
  }
}
