import puppeteer, { Browser, ElementHandle, Page } from "puppeteer";
import user from "./config";

let startButton = "#continue_session_button";

let window: any;

const check_display = function (el: any) {
  return el.style.display == "none";
};
// finish: finish_page
(async () => {
  const browser = await puppeteer.launch({
    headless: user.headless,
    args: [(process.env.OS == "docker") ? "--no-sandbox" : ""]
  });
  const page = await browser.newPage();

  await page.goto("https://instaling.pl/teacher.php?page=login");

  await delay(500);
  try {

    let consestButton: ElementHandle | null = await page.waitForSelector(".fc-cta-consent", { timeout: 5000 });
    console.log(consestButton)
    await consestButton?.click();
  } catch (e) {
    console.log("can't wait for '.fc-cta-consent' button <IGNORED>")
  }
  await delay(500)

  console.log("login> ", process.env.login || user.login);

  let email = await page.waitForSelector("#log_email");
  await email?.type(process.env.login || user.login);
  let password = await page.waitForSelector("#log_password");
  await password?.type(process.env.password || user.password);
  let sub = await page.waitForSelector("button[type=submit]");
  await sub?.click();

  await page.waitForNavigation();
  await delay(200);

  let url = await page.url().slice("https://instaling.pl/".length);
  if (!url.startsWith("student")) {
    console.error("Wrong password/login!\nor server error?");

    browser.close();
    return;
  }

  console.log("waiting for .btn-session selector");
  await delay(500);
  let start = await page.$(".btn-session.btn.sesion");
  let link = await (await start?.getProperty("href"))?.jsonValue()

  console.log(link)
  page.goto(link as string)
  await delay(500);
  // console.log(await start!.getProperty("href"))
  // await start!.click()
  console.log("start");

  // await delay(500);
  await page.waitForNavigation({ waitUntil: "load", timeout: 3000 }).catch(
    (err) => {
      console.error("couldn't wait for navigation");
    },
  );

  while (
    await page.$eval(
      "#loading",
      `!(${check_display.toString()})(document.querySelector('#loading'))`,
    )
  ) { } // loading screen secure

  let ssp = await page.$eval(
    "#start_session_page",
    `(${check_display.toString()})(document.querySelector('#start_session_page'))`,
  );
  let csp = await page.$eval(
    "#continue_session_page",
    `(${check_display.toString()})(document.querySelector('#continue_session_page'))`,
  );

  if (!ssp) startButton = "#start_session_button";
  else startButton = "#continue_session_button";

  let start_session = await page.waitForSelector(startButton);

  await delay(500);
  console.log("starting session");
  await page.evaluate(`document.querySelector('${startButton}').click();`);
  await delay(100);
  await page.waitForSelector(".translations");

  setTimeout(beginTest, 2000, page, browser);
  //beginTest(page);
})();

interface word {
  translation: string;
  word: string;
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function getContent(element: ElementHandle) {
  return (await (await element.getProperty("textContent")).toString()).slice(
    "jshandle:".length,
  );
}

function getTranslation(translation: string, array: word[]): word | null {
  for (const i of array) {
    //console.log(`${i.translation} - ${translation} = ${i.translation==translation}`)
    if (i.translation == translation) return i;
  }
  return null;
}
async function divCheck(page: Page) {
  try {
    await page.waitForSelector("div#check", { timeout: 5000 });
    await (await page.$("div#check"))?.click();
    console.log("check")
  } catch (e) {
    await page.waitForSelector("div#check_answer", { timeout: 5000 }).catch((res) => { });
    await (await page.$("div#check_answer"))?.click();
    console.log("check_answer")
  }
}

async function beginTest(page: Page, browser: Browser) {
  let word_list: word[] = [];

  let input = await page.waitForSelector("input#answer");

  let i = 0;
  let check_end = async () =>
    await page.$eval("#finish_page", (el) => {
      return window.getComputedStyle(el).getPropertyValue("display") == "none";
    });
  while (await check_end()) {
    i++;
    await delay(250);
    await page.waitForSelector("div.translations");
    let translation = await page.$eval(".translations", (el) => el.innerHTML);

    console.log("loop: ", i);

    let wr = getTranslation(translation, word_list)!;

    if (wr != null) {
      await delay(100);
      await input!.type(wr.word);
      console.log(`found ${wr.translation} is ${wr.word}`);

      await delay(1000);
      if (!await check_end()) continue;
      await divCheck(page);
      await delay(500);
      let result = await page.$eval("#answer_result>div", (e: HTMLDivElement) => e.classList[0])
      if (result == "red") {
        console.warn("found incorrectly word")
        word_list.splice(word_list.indexOf(wr), 1);
      } else {
        console.log("correct")
      }
    } else {
      await delay(500);
      divCheck(page)
      // await (await page.$("div#check"))!.click();

      await delay(200);
      await page.waitForSelector("div#word");
      let word = await page.$eval("div#word", (el) => el.innerHTML);

      word_list.push({ translation: translation, word: word });
    }
    await delay(1000);
    // console.log("check_end: " + await check_end());
    if (!await check_end()) continue;
    try {
      await page.waitForSelector("div#nextword", { visible: true });
      await (await page.$("div#nextword"))!.click();
    } catch (e) {
      console.error("error occured")
    }
  }

  console.log(word_list);
  browser.close().catch(() => console.error("couldn't close the browser"));
}
