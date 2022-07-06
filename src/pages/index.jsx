import { useState, useEffect } from 'react'
import { unstable_getServerSession } from 'next-auth/next'
import {
  useDrop,
  usePrevious,
  useDeepCompareEffect,
  useToggle,
  createBreakpoint,
  useWindowSize,
} from 'react-use'
import { authOptions } from '@/api/auth/[...nextauth]'
import { useStore, initializeStore } from '@/lib/store'
import { useToast, toastTypes } from '@/lib/hooks'

import SlideOut from '@/components/slide-out'
import Pagination from '@/components/pagination'
import BookmarkCard from '@/components/bookmark-card'
import Layout from '@/components/layout'
import EmptyDashboard from '@/components/empty-dashboard'
import DashboardHeader from '@/components/dashboard-header'
import QuickAdd from '@/components/quick-add'
import DataTable from '@/components/table'
import Modal from '@/components/modal'
import { viewTypes } from '@/lib/constants'
import prisma from '@/lib/prisma'

const PAGE_SIZE = 15

const useBreakpoint = createBreakpoint({
  '3xl': 2200,
  '2xl': 1536,
  xl: 1280,
  lg: 1024,
  md: 768,
  s: 640,
})

export default function Home({ nextauth }) {
  const bookmarks = useStore((state) => state.bookmarks)
  const categories = useStore((state) => state.categories)
  const categoryFilter = useStore((state) => state.categoryFilter)
  const tagFilter = useStore((state) => state.tagFilter)
  const searchText = useStore((state) => state.searchText)
  const setUserSetting = useStore((state) => state.setUserSetting)
  const settings = useStore((state) => state.settings)
  const setEditBookmark = useStore((state) => state.setEditBookmark)
  const addBookmark = useStore((state) => state.addBookmark)
  const previousSearchText = usePrevious(searchText)
  const breakpoint = useBreakpoint()
  const { width } = useWindowSize()

  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [droppedUrl, setDroppedUrl] = useState('')
  const [currentTableData, setCurrentTableData] = useState([])
  const [openModal, toggleModal] = useToggle(false)
  const [loading, toggleLoading] = useToggle(false)
  const [openEditSidebar, toggleEditSidebar] = useToggle(false)
  const [filteredLength, setFilteredLength] = useState(bookmarks.length)
  const [currentPage, setCurrentPage] = useState(1)
  const toast = useToast(5000)

  useEffect(() => {
    if (breakpoint === '3xl') {
      setPageSize(Math.floor(PAGE_SIZE * 1.2))
    } else if (breakpoint === '2xl') {
      setPageSize(PAGE_SIZE)
    } else if (breakpoint === 'xl') {
      setPageSize(Math.floor(PAGE_SIZE * 0.8))
    } else if (breakpoint === 'lg') {
      setPageSize(Math.floor(PAGE_SIZE * 0.65))
    } else if (breakpoint === 'md') {
      setPageSize(Math.floor(PAGE_SIZE * 0.4))
    } else if (breakpoint === 's') {
      setPageSize(Math.floor(PAGE_SIZE * 0.4))
    }
  }, [width, breakpoint])

  const initEdit = (bookmark) => {
    setEditBookmark(bookmark)
    toggleEditSidebar()
  }

  useDeepCompareEffect(() => {
    const firstPageIndex = (currentPage - 1) * pageSize
    const lastPageIndex = firstPageIndex + pageSize
    const currentBookmarks = bookmarks
      .reduce((bookmarks, thisBookmark) => {
        if (categoryFilter || tagFilter) {
          // Filter shown bookmarks selected sidebar filters
          if (thisBookmark.categoryId === categoryFilter) {
            bookmarks.push(thisBookmark)
          } else if (thisBookmark.tags.some((tag) => tag.id === tagFilter)) {
            bookmarks.push(thisBookmark)
          }
        } else if (searchText) {
          // Filter shown bookmarks on search
          if (
            thisBookmark.url.toLowerCase().includes(searchText.toLowerCase()) ||
            thisBookmark.title
              ?.toLowerCase()
              .includes(searchText.toLowerCase()) ||
            thisBookmark.desc?.toLowerCase().includes(searchText.toLowerCase())
          ) {
            previousSearchText !== searchText && setCurrentPage(1)
            bookmarks.push(thisBookmark)
          }
        } else {
          bookmarks.push(thisBookmark)
        }
        setFilteredLength(bookmarks.length)
        return bookmarks
      }, [])
      .slice(firstPageIndex, lastPageIndex)
    setCurrentTableData(currentBookmarks)
  }, [currentPage, categoryFilter, tagFilter, searchText, bookmarks, pageSize])

  useEffect(() => {
    const getLanguage = () =>
      navigator.userLanguage ||
      (navigator.languages &&
        navigator.languages.length &&
        navigator.languages[0]) ||
      navigator.language ||
      navigator.browserLanguage ||
      navigator.systemLanguage ||
      'en-US'

    setUserSetting({ locale: getLanguage() })
  }, [setUserSetting])

  const saveBookmark = async (url) => {
    try {
      toggleLoading(true)
      // Add Bookmark to DB via API
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          userId: nextauth?.user?.userId,
        }),
      })
      if (res.status === 200) {
        toast(toastTypes.SUCCESS, 'Successfully added', url)
        const { data } = await res.json()

        // Add new Bookmark to UI
        addBookmark({
          url: data.url,
          createdAt: data.createdAt,
          id: data.id,
          desc: data.desc,
          image: data.image,
          title: data.title,
          tags: data.tags,
          category: data.category,
        })

        open && toggleModal()
      } else {
        toast(toastTypes.ERROR, 'Error Saving')
      }
    } catch (error) {
      console.error(`[ERROR] Saving Dropped URL ${url}:`, error)
      toast(toastTypes.ERROR, 'Error adding', url)
    }
    toggleLoading(false)
  }

  // Catch dropped URL anywhere on page
  useDrop({
    onUri: (uri) => {
      setDroppedUrl(uri)
      toggleModal()
    },
  })

  return (
    <Layout session={nextauth}>
      <div className="flex h-full flex-col items-center space-y-2">
        <DashboardHeader />
        {bookmarks.length === 0 && <EmptyDashboard />}
        {bookmarks.length > 0 && currentTableData.length === 0 && (
          <div className="flex flex-col items-center justify-center text-lg text-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/not-found.png"
              className="h-auto w-5/6 lg:w-[32rem]"
              alt="No Results, Please Try Again"
            />
            <span className="text-2xl font-thin">
              No results found, please try again!
            </span>
          </div>
        )}
        <div className="z-20 w-full grow overflow-x-hidden overflow-y-visible">
          <section className="flex h-full flex-col items-center justify-start px-2 md:px-4">
            {currentTableData.length !== 0 &&
              settings.activeView === viewTypes.CARD.name && (
                <section className="grid w-full grid-cols-[repeat(auto-fill,_minmax(300px,_1fr))] grid-rows-[repeat(auto-fit,_minmax(340px,_1fr))] items-start justify-items-center gap-4 px-2 md:justify-items-start md:justify-self-start md:px-4">
                  {currentTableData.map((bookmark) => (
                    <BookmarkCard
                      bookmark={bookmark}
                      key={bookmark.id}
                      session={nextauth}
                      toggleSidebar={() => initEdit(bookmark)}
                    />
                  ))}
                </section>
              )}
            {currentTableData.length !== 0 &&
              settings.activeView === viewTypes.LIST.name && (
                <DataTable items={currentTableData} initEdit={initEdit} />
              )}
            {currentTableData.length !== 0 &&
              settings.activeView === viewTypes.DETAIL.name && (
                <div className="flex justify-center text-lg text-slate-700">
                  This view has not been implemented yet, please try Card or
                  List view
                </div>
              )}
          </section>
        </div>
        <Pagination
          currentPage={currentPage}
          totalCount={
            searchText || categoryFilter || tagFilter
              ? filteredLength
              : bookmarks.length
          }
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
        />
        <QuickAdd categories={categories} session={nextauth} />
        <SlideOut
          open={openEditSidebar}
          toggleOpen={toggleEditSidebar}
          session={nextauth}
        />
        {openModal && (
          <Modal
            saveBookmark={saveBookmark}
            open={openModal}
            loading={loading}
            toggleModal={toggleModal}
            url={droppedUrl}
          />
        )}
      </div>
    </Layout>
  )
}

export async function getServerSideProps(context) {
  const session = await unstable_getServerSession(
    context.req,
    context.res,
    authOptions
  )
  const zustandStore = initializeStore()

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    }
  }

  const bookmarkData = await prisma.bookmark.findMany({
    orderBy: { createdAt: 'desc' },
    where: {
      userId: session.user.userId,
    },
    include: {
      category: true,
      tags: { include: { tag: true } },
    },
  })

  const categories = await prisma.category.findMany({
    where: {
      userId: session.user.userId,
    },
    include: {
      _count: {
        select: { bookmarks: true },
      },
    },
  })
  const tags = await prisma.tag.findMany({
    where: {
      userId: session.user.userId,
    },
    include: {
      _count: {
        select: { bookmarks: true },
      },
    },
  })

  // Convert 'createdAt' to string to pass through as json
  const bookmarks = bookmarkData.map((boomark) => ({
    ...boomark,
    createdAt: boomark.createdAt.toString(),
    tags: boomark.tags.map((tag) => tag.tag),
  }))

  zustandStore.getState().setBookmarks(bookmarks)
  zustandStore.getState().setCategories(categories)
  zustandStore.getState().setTags(tags)

  return {
    props: {
      session,
      nextauth: session,
      initialZustandState: JSON.parse(JSON.stringify(zustandStore.getState())),
    },
  }
}
